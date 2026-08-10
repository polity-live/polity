import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  childBases: vi.fn(),
  networkMeta: vi.fn(),
  effectiveOffline: vi.fn(),
  personKey: vi.fn(),
  hierarchy: vi.fn(),
  attendanceMode: vi.fn(),
}));

vi.mock('@/features/groups/logic/hierarchy', () => ({ resolveChildBaseGroups: mocks.childBases }));
vi.mock('../network/derived', () => ({
  buildDerivedGroupNetworkMetaMap: (...args: unknown[]) => mocks.networkMeta(...args),
}));
vi.mock('../groups/offline-membership-helpers', () => ({
  loadEffectiveOfflineMembershipsForGroup: (...args: unknown[]) =>
    mocks.effectiveOffline(...args),
  buildOfflineMembershipPersonKey: (...args: unknown[]) => mocks.personKey(...args),
}));
vi.mock('../groups/membership-helpers', () => ({
  loadActiveHierarchyRelationships: (...args: unknown[]) => mocks.hierarchy(...args),
}));
vi.mock('../events/attendance-mode', () => ({
  resolveEventAttendanceMode: (...args: unknown[]) => mocks.attendanceMode(...args),
}));

import {
  computeDistinctGroupMemberCount,
  eventAllowsOnlineVoting,
  getConfirmedOfflineAttendeeCount,
  getDefaultOfflineParticipationChannel,
  getEffectiveOnlineParticipantUserIdsForEvent,
  getHybridOfflineOverrideUserIdsForEvent,
  getOfflineRosterMembersForGeneralAssembly,
  isUserForcedOfflineForEvent,
  loadOfflineRosterMembersForGroup,
  resolveOfflineRosterSourceGroupIds,
} from '../offline-roster-helpers';

function networkTx(groups: any[], extraResults: unknown[] = []) {
  return {
    run: vi
      .fn()
      .mockResolvedValueOnce(groups)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async () => extraResults.shift()),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.networkMeta.mockReturnValue(new Map());
  mocks.childBases.mockReturnValue([]);
  mocks.hierarchy.mockResolvedValue([]);
  mocks.effectiveOffline.mockResolvedValue([]);
  mocks.personKey.mockImplementation(({ offlineMemberId, connectedUserId }: any) =>
    connectedUserId ? `user:${connectedUserId}` : offlineMemberId ? `offline:${offlineMemberId}` : null
  );
  mocks.attendanceMode.mockImplementation((event: any) => event.mode);
});

describe('offline roster source resolution', () => {
  it('returns empty for missing groups and source-less non-roster group types', async () => {
    await expect(resolveOfflineRosterSourceGroupIds(networkTx([]), 'missing')).resolves.toEqual([]);
    await expect(
      resolveOfflineRosterSourceGroupIds(
        networkTx([{ id: 'group-1', group_type: 'informal' }]),
        'group-1'
      )
    ).resolves.toEqual([]);
  });

  it('resolves base groups and merges derived network metadata', async () => {
    mocks.networkMeta.mockReturnValue(
      new Map([['group-1', { group_type: 'base', sibling_membership_mode: 'derived' }]])
    );
    const tx = networkTx([{ id: 'group-1', group_type: 'informal' }]);
    await expect(resolveOfflineRosterSourceGroupIds(tx, 'group-1')).resolves.toEqual(['group-1']);
    expect(mocks.networkMeta).toHaveBeenCalledWith({
      groupIds: ['group-1'],
      connections: [],
      grants: [],
      rules: [],
    });
  });

  it('uses descendant bases for hierarchical groups and falls back to the group itself', async () => {
    const groups = [{ id: 'root', group_type: 'hierarchical' }];
    const tx = networkTx(groups, [groups]);
    mocks.childBases.mockReturnValueOnce(['base-1', 'base-2']);
    await expect(resolveOfflineRosterSourceGroupIds(tx, 'root')).resolves.toEqual([
      'base-1',
      'base-2',
    ]);
    expect(mocks.hierarchy).toHaveBeenCalled();

    const fallbackTx = networkTx(groups, [groups]);
    mocks.childBases.mockReturnValueOnce([]);
    await expect(resolveOfflineRosterSourceGroupIds(fallbackTx, 'root')).resolves.toEqual(['root']);
  });

  it('resolves elected sibling sources, missing connections and recursion cycles', async () => {
    const base = { id: 'base-1', group_type: 'base' };
    const elected = {
      id: 'elected',
      group_type: 'sibling',
      sibling_membership_mode: 'elected',
      connected_group_id: 'base-1',
    };
    await expect(
      resolveOfflineRosterSourceGroupIds(networkTx([elected, base]), 'elected')
    ).resolves.toEqual(['base-1']);

    const missing = { ...elected, connected_group_id: 'missing' };
    await expect(
      resolveOfflineRosterSourceGroupIds(networkTx([missing]), 'elected')
    ).resolves.toEqual([]);

    const first = { ...elected, id: 'first', connected_group_id: 'second' };
    const second = { ...elected, id: 'second', connected_group_id: 'first' };
    await expect(
      resolveOfflineRosterSourceGroupIds(networkTx([first, second]), 'first')
    ).resolves.toEqual([]);
  });

  it('deduplicates parliament base sources and skips missing or already visited groups', async () => {
    const parliament = {
      id: 'parliament',
      group_type: 'sibling',
      sibling_membership_mode: 'parliament',
      parliament_source_group_ids: ['base-1', 'missing', 'base-1'],
    };
    const base = { id: 'base-1', group_type: 'base' };
    await expect(
      resolveOfflineRosterSourceGroupIds(networkTx([parliament, base]), 'parliament')
    ).resolves.toEqual(['base-1']);

    const noSources = { ...parliament, parliament_source_group_ids: undefined };
    await expect(
      resolveOfflineRosterSourceGroupIds(networkTx([noSources]), 'parliament')
    ).resolves.toEqual([]);

    const otherSibling = { ...parliament, sibling_membership_mode: 'manual' };
    await expect(
      resolveOfflineRosterSourceGroupIds(networkTx([otherSibling]), 'parliament')
    ).resolves.toEqual([]);
  });

  it('loads related roster members only when source groups exist and aliases assembly loading', async () => {
    const emptyTx = networkTx([]);
    await expect(loadOfflineRosterMembersForGroup(emptyTx, 'missing')).resolves.toEqual([]);
    expect(emptyTx.run).toHaveBeenCalledTimes(4);

    const rows = [{ id: 'offline-1' }];
    const tx = networkTx([{ id: 'base-1', group_type: 'base' }], [rows]);
    await expect(loadOfflineRosterMembersForGroup(tx, 'base-1')).resolves.toEqual(rows);
    expect(tx.run).toHaveBeenCalledTimes(5);

    const assemblyTx = networkTx([{ id: 'base-1', group_type: 'base' }], [rows]);
    await expect(
      getOfflineRosterMembersForGeneralAssembly(assemblyTx, 'base-1')
    ).resolves.toEqual(rows);
  });
});

describe('distinct offline roster counts', () => {
  it('deduplicates active users, connected people and standalone offline people', async () => {
    const tx = {
      run: vi.fn().mockResolvedValue([
        { user_id: '', status: 'active' },
        { user_id: 'user-1', status: 'active' },
        { user_id: 'user-1', status: 'member' },
        { user_id: 'admin-1', status: 'admin' },
        { user_id: 'ignored', status: 'invited' },
      ]),
    } as any;
    mocks.effectiveOffline.mockResolvedValue([
      { group_offline_member: { id: 'offline-1', connected_user_id: null } },
      { group_offline_member: { id: 'offline-2', connected_user_id: 'user-1' } },
      { group_offline_member: null },
    ]);
    await expect(computeDistinctGroupMemberCount(tx, 'group-1')).resolves.toBe(3);
  });
});

describe('offline event participation', () => {
  it('selects the default channel from hybrid mode and connected identity', () => {
    expect(
      getDefaultOfflineParticipationChannel({ attendanceMode: 'hybrid', connectedUserId: 'user-1' })
    ).toBe('online');
    expect(
      getDefaultOfflineParticipationChannel({ attendanceMode: 'hybrid', connectedUserId: null })
    ).toBe('offline');
    expect(
      getDefaultOfflineParticipationChannel({ attendanceMode: 'offline', connectedUserId: 'user-1' })
    ).toBe('offline');
  });

  it('collects only connected users explicitly forced offline', async () => {
    const tx = {
      run: vi.fn().mockResolvedValue([
        { connected_user_id: null, participation_channel: 'offline' },
        { connected_user_id: 'online-user', participation_channel: 'online' },
        { connected_user_id: 'offline-user', participation_channel: 'offline' },
        { connected_user_id: 'offline-user', participation_channel: 'offline' },
      ]),
    } as any;
    await expect(getHybridOfflineOverrideUserIdsForEvent(tx, 'event-1')).resolves.toEqual(
      new Set(['offline-user'])
    );
  });

  it('counts distinct confirmed offline attendees', async () => {
    const tx = {
      run: vi.fn().mockResolvedValue([
        {
          id: 'offline-1',
          connected_user_id: null,
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
        {
          id: 'offline-2',
          connected_user_id: 'user-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
        {
          id: 'ignored-1',
          attendance_status: 'invited',
          participation_channel: 'offline',
        },
        {
          id: 'ignored-2',
          attendance_status: 'confirmed',
          participation_channel: 'online',
        },
      ]),
    } as any;
    await expect(getConfirmedOfflineAttendeeCount(tx, 'event-1')).resolves.toBe(2);
  });

  it('allows online voting only for existing non-offline events', async () => {
    await expect(
      eventAllowsOnlineVoting({ run: vi.fn().mockResolvedValue(null) } as any, 'missing')
    ).resolves.toBe(false);
    await expect(
      eventAllowsOnlineVoting(
        { run: vi.fn().mockResolvedValue({ mode: 'offline' }) } as any,
        'event-1'
      )
    ).resolves.toBe(false);
    await expect(
      eventAllowsOnlineVoting(
        { run: vi.fn().mockResolvedValue({ mode: 'hybrid' }) } as any,
        'event-1'
      )
    ).resolves.toBe(true);
  });

  it('checks forced-offline users only for hybrid events', async () => {
    const missing = { run: vi.fn().mockResolvedValue(null) } as any;
    await expect(isUserForcedOfflineForEvent(missing, 'event-1', 'user-1')).resolves.toBe(false);

    const offline = { run: vi.fn().mockResolvedValue({ mode: 'offline' }) } as any;
    await expect(isUserForcedOfflineForEvent(offline, 'event-1', 'user-1')).resolves.toBe(false);

    const hybridFalse = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ mode: 'hybrid' })
        .mockResolvedValueOnce([{ participation_channel: 'online' }]),
    } as any;
    await expect(isUserForcedOfflineForEvent(hybridFalse, 'event-1', 'user-1')).resolves.toBe(false);

    const hybridTrue = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ mode: 'hybrid' })
        .mockResolvedValueOnce([
          { participation_channel: 'online' },
          { participation_channel: 'offline' },
        ]),
    } as any;
    await expect(isUserForcedOfflineForEvent(hybridTrue, 'event-1', 'user-1')).resolves.toBe(true);
  });

  it('removes forced-offline users from the effective active online set', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce([
          { user_id: 'active', status: 'active' },
          { user_id: 'confirmed', status: 'confirmed' },
          { user_id: 'member', status: 'member' },
          { user_id: 'admin', status: 'admin' },
          { user_id: 'invited', status: 'invited' },
        ])
        .mockResolvedValueOnce([
          { connected_user_id: 'confirmed', participation_channel: 'offline' },
        ]),
    } as any;
    await expect(getEffectiveOnlineParticipantUserIdsForEvent(tx, 'event-1')).resolves.toEqual([
      'active',
      'member',
      'admin',
    ]);
  });
});
