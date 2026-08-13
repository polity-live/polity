import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => vi.resetModules());

async function loadReconciler() {
  const harness = createQueryHarness();
  const state = {
    group: { id: 'group-1', group_type: 'hierarchical' } as any,
    descendantIds: ['base-1'] as string[],
    directMemberships: [] as any[],
    descendantMemberships: [] as any[],
    offlineMemberships: [] as any[],
  };
  const fireNotification = vi.fn();
  const recomputeEventCounters = vi.fn();
  const syncUserWithEventConversation = vi.fn();
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  vi.doMock('../../groups/membership-helpers', () => ({
    loadGroupWithDerivedNetworkMeta: vi.fn(async () => state.group),
    buildGroupsById: vi.fn(async () => new Map()),
    loadActiveHierarchyRelationships: vi.fn(async () => []),
  }));
  vi.doMock('../../groups/offline-membership-helpers', () => ({
    loadEffectiveOfflineMembershipsForGroup: vi.fn(async () => state.offlineMemberships),
    buildOfflineMembershipPersonKey: ({
      offlineMemberId,
      connectedUserId,
    }: {
      offlineMemberId?: string;
      connectedUserId?: string | null;
    }) => connectedUserId || offlineMemberId || null,
  }));
  vi.doMock('@/features/groups/logic/hierarchy', () => ({
    resolveChildBaseGroups: vi.fn(() => state.descendantIds),
  }));
  vi.doMock('../../offline-roster-helpers', () => ({
    getDefaultOfflineParticipationChannel: ({ connectedUserId }: { connectedUserId?: string }) =>
      connectedUserId ? 'online' : 'offline',
  }));
  vi.doMock('../../server-helpers', () => ({
    isActiveGroupStatus: (status?: string | null) =>
      ['active', 'member', 'admin'].includes(status ?? ''),
    recomputeEventCounters,
    syncUserWithEventConversation,
  }));
  vi.doMock('../../server-notify', () => ({ fireNotification }));
  const mod = await import('../assembly-reconcile');
  return {
    ...mod,
    harness,
    state,
    fireNotification,
    recomputeEventCounters,
    syncUserWithEventConversation,
  };
}

function createTx(harness: ReturnType<typeof createQueryHarness>, state: any) {
  const config = {
    event: null as any,
    roles: [] as any[],
    participants: [] as any[],
    offlineParticipants: [] as any[],
    existingLink: null as any,
    existingRoleLinks: [] as any[],
    groupEvents: [] as any[],
  };
  const operations = new Map<string, ReturnType<typeof vi.fn>>();
  const mutate = new Proxy(
    {},
    {
      get: (_target, table) =>
        new Proxy(
          {},
          {
            get: (_table, operation) => {
              const key = `${String(table)}.${String(operation)}`;
              if (!operations.has(key)) operations.set(key, vi.fn().mockResolvedValue(undefined));
              return operations.get(key);
            },
          }
        ),
    }
  );
  const tx = {
    run: vi.fn(async (query: { table?: string; calls?: any[] }) => {
      const table = query?.table;
      const isOne = query?.calls?.some(call => call[0] === 'one');
      if (table === 'event') return isOne ? config.event : config.groupEvents;
      if (table === 'group_membership') {
        const isDescendant = query.calls?.some(call => call[0] === 'where' && call[2] === 'IN');
        return isDescendant ? state.descendantMemberships : state.directMemberships;
      }
      if (table === 'role') return config.roles;
      if (table === 'event_participant') return config.participants;
      if (table === 'event_offline_participant') return config.offlineParticipants;
      if (table === 'event_participant_role')
        return isOne ? config.existingLink : config.existingRoleLinks;
      return undefined;
    }),
    mutate,
  };
  return {
    tx,
    config,
    operation: (table: string, operation: string) =>
      operations.get(`${table}.${operation}`) ?? vi.fn(),
  };
}

describe('general assembly reconciliation coverage', () => {
  it('covers early exits, hierarchy eligibility, role sync, roster updates, and group batches', async () => {
    const loaded = await loadReconciler();
    const test = createTx(loaded.harness, loaded.state);

    for (const event of [
      null,
      { id: 'event-1', event_type: 'meeting', group_id: 'group-1' },
      { id: 'event-1', event_type: 'general_assembly', group_id: null },
    ]) {
      test.config.event = event;
      await loaded.reconcileGeneralAssemblyParticipantsForEvent(test.tx as never, 'event-1');
    }

    const now = Date.now();
    loaded.state.directMemberships = [
      { user_id: 'direct-active', status: 'active', source: 'direct' },
      { user_id: 'derived-active', status: 'active', source: 'derived' },
      { user_id: 'direct-inactive', status: 'left', source: 'direct' },
    ];
    loaded.state.descendantMemberships = [
      { user_id: 'desc-active', status: 'member', source: 'direct' },
      { user_id: 'desc-derived', status: 'active', source: 'derived' },
      { user_id: 'desc-inactive', status: 'left', source: 'direct' },
    ];
    loaded.state.offlineMemberships = [
      { group_offline_member: null },
      {
        group_offline_member: {
          id: 'offline-source',
          first_name: 'Updated',
          last_name: 'Member',
          reason_not_signed_up: null,
          connected_user_id: 'connected-1',
        },
      },
      {
        group_offline_member: {
          id: 'offline-duplicate',
          first_name: 'Duplicate',
          last_name: 'Member',
          reason_not_signed_up: 'reason',
          connected_user_id: 'connected-1',
        },
      },
      {
        group_offline_member: {
          id: 'offline-new',
          first_name: 'New',
          last_name: 'Person',
          reason_not_signed_up: undefined,
          connected_user_id: null,
        },
      },
      {
        group_offline_member: {
          id: '',
          first_name: 'No',
          last_name: 'Key',
          reason_not_signed_up: null,
          connected_user_id: null,
        },
      },
      {
        group_offline_member: {
          id: 'source-rebound',
          first_name: 'Rebound',
          last_name: 'Person',
          reason_not_signed_up: null,
          connected_user_id: null,
        },
      },
      {
        group_offline_member: {
          id: 'new-source',
          first_name: 'Connected',
          last_name: 'Match',
          reason_not_signed_up: null,
          connected_user_id: 'connected-unique',
        },
      },
      {
        group_offline_member: {
          id: 'offline-exact',
          first_name: 'Exact',
          last_name: 'Person',
          reason_not_signed_up: null,
          connected_user_id: null,
        },
      },
    ];
    test.config.event = {
      id: 'event-1',
      event_type: 'general_assembly',
      group_id: 'group-1',
      creator_id: 'creator-1',
      title: null,
      visibility: null,
      attendance_mode: 'hybrid',
      location_type: 'physical',
      start_date: now - 1000,
      end_date: now + 10_000,
    };
    test.config.roles = [
      { id: 'guest', name: 'Guest', assignee_kind: 'guest' },
      { id: 'participant', name: 'Participant', assignee_kind: 'member' },
      { id: 'default', default_invite_role: true },
    ];
    test.config.participants = [
      { id: 'existing', user_id: 'direct-active', participant_roles: null },
      {
        id: 'remove',
        user_id: 'ineligible',
        participant_roles: [{ id: 'link-remove', role: { assignee_kind: 'member' } }],
      },
      {
        id: 'guest',
        user_id: 'guest-user',
        participant_roles: [{ id: 'link-guest', role: { assignee_kind: 'guest' } }],
      },
    ];
    test.config.offlineParticipants = [
      {
        id: 'offline-existing',
        group_offline_member_id: 'offline-source',
        first_name: 'Old',
        last_name: 'Name',
        reason_not_signed_up: 'old',
        connected_user_id: null,
        participation_channel: 'offline',
      },
      {
        id: 'offline-connected',
        group_offline_member_id: null,
        first_name: 'Duplicate',
        last_name: 'Member',
        reason_not_signed_up: 'reason',
        connected_user_id: 'connected-1',
        participation_channel: 'online',
      },
      { id: 'offline-stale', group_offline_member_id: 'stale' },
      {
        id: 'offline-rebound',
        group_offline_member_id: 'source-rebound',
        first_name: 'Rebound',
        last_name: 'Person',
        reason_not_signed_up: null,
        connected_user_id: 'old-connected',
        participation_channel: 'online',
      },
      {
        id: 'offline-source-mismatch',
        group_offline_member_id: 'old-source',
        first_name: 'Connected',
        last_name: 'Match',
        reason_not_signed_up: null,
        connected_user_id: 'connected-unique',
        participation_channel: 'online',
      },
      {
        id: 'offline-exact-participant',
        group_offline_member_id: 'offline-exact',
        first_name: 'Exact',
        last_name: 'Person',
        reason_not_signed_up: null,
        connected_user_id: null,
        participation_channel: 'offline',
      },
    ];
    test.config.existingRoleLinks = [
      { id: 'old-role-link', role_id: 'old-role' },
      { id: 'kept-role-link', role_id: 'default' },
    ];
    test.config.existingLink = null;

    await loaded.reconcileGeneralAssemblyParticipantsForEvent(
      test.tx as never,
      'event-1',
      'assigner-1'
    );

    expect(test.operation('event_participant', 'insert')).toHaveBeenCalled();
    expect(test.operation('event_participant', 'delete')).toHaveBeenCalled();
    expect(test.operation('event_offline_participant', 'update')).toHaveBeenCalled();
    expect(test.operation('event_offline_participant', 'insert')).toHaveBeenCalled();
    expect(test.operation('event_offline_participant', 'delete')).toHaveBeenCalled();
    expect(loaded.recomputeEventCounters).toHaveBeenCalled();
    expect(loaded.fireNotification).toHaveBeenCalled();

    loaded.state.group = null;
    test.config.event = {
      ...test.config.event,
      attendance_mode: 'online',
      end_date: null,
      start_date: null,
    };
    test.config.roles = [{ id: 'participant', name: 'Participant', assignee_kind: 'member' }];
    test.config.participants = [];
    test.config.offlineParticipants = [{ id: 'online-stale' }];
    await loaded.reconcileGeneralAssemblyParticipantsForEvent(test.tx as never, 'event-1');

    loaded.state.group = { id: 'group-1', group_type: 'flat' };
    loaded.state.directMemberships = [
      { user_id: 'flat-user', status: 'active', source: 'derived' },
    ];
    test.config.event = {
      ...test.config.event,
      attendance_mode: 'offline',
      start_date: now + 1000,
      visibility: 'private',
      title: 'Assembly',
    };
    test.config.roles = [{ id: 'participant', name: 'Participant', assignee_kind: 'member' }];
    test.config.existingRoleLinks = [];
    test.config.existingLink = null;
    test.config.offlineParticipants = [];
    await loaded.reconcileGeneralAssemblyParticipantsForEvent(test.tx as never, 'event-1');

    loaded.state.directMemberships = [
      { user_id: 'flat-user-2', status: 'active', source: 'direct' },
    ];
    test.config.existingLink = { id: 'already-linked' };
    await loaded.reconcileGeneralAssemblyParticipantsForEvent(test.tx as never, 'event-1');

    loaded.state.group = { id: 'group-1', group_type: 'hierarchical' };
    loaded.state.descendantIds = [];
    loaded.state.directMemberships = [];
    test.config.participants = [
      { id: 'past-participant', user_id: 'past-user', participant_roles: undefined },
    ];
    test.config.event = {
      ...test.config.event,
      attendance_mode: undefined,
      location_type: 'online',
      start_date: now - 10_000,
      end_date: null,
    };
    await loaded.reconcileGeneralAssemblyParticipantsForEvent(test.tx as never, 'event-1');

    test.config.event = {
      ...test.config.event,
      attendance_mode: undefined,
      location_type: 'physical',
      start_date: now + 10_000,
    };
    test.config.participants = [
      { id: 'future-no-roles', user_id: 'future-ineligible', participant_roles: undefined },
    ];
    await loaded.reconcileGeneralAssemblyParticipantsForEvent(test.tx as never, 'event-1');

    test.config.groupEvents = [
      { id: 'cancelled', status: 'cancelled' },
      { id: 'active', status: 'active' },
    ];
    test.config.event = { ...test.config.event, id: 'active' };
    await loaded.reconcileGeneralAssemblyParticipantsForGroups(
      test.tx as never,
      ['', 'group-1', 'group-1'],
      null
    );
  });
});
