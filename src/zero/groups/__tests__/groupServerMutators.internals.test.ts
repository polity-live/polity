import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  roleName: vi.fn(async (_tx: unknown, id: string) => ({ name: `Role ${id}` })),
  groupName: vi.fn(async (_tx: unknown, id: string) => `Group ${id}`),
  graphAffected: ['graph'] as string[],
  offlineHierarchy: ['offline'] as string[],
  sibling: ['sibling'] as string[],
  offlineSibling: ['offline-sibling'] as string[],
  reconcileGraph: vi.fn(),
  groupCounter: vi.fn(),
  assembly: vi.fn(),
  allocations: vi.fn(),
}));

vi.mock('../../server-notify', () => ({ fireNotification: mocks.notify }));
vi.mock('../../server-helpers', () => ({
  amendmentTitle: vi.fn(),
  blogTitle: async () => 'Blog title',
  eventTitle: vi.fn(),
  groupName: mocks.groupName,
  userName: vi.fn(),
  roleName: mocks.roleName,
  isActiveGroupStatus: (status: string) => ['active', 'member', 'admin'].includes(status),
  ensureGroupConversation: vi.fn(),
  recomputeGroupCounters: mocks.groupCounter,
  recomputeUserCounters: vi.fn(),
  syncUserWithGroupConversation: vi.fn(),
}));
vi.mock('../../network/group-graph-reconcile', () => ({
  reconcileGroupGraph: (...args: unknown[]) => mocks.reconcileGraph(...args),
}));
vi.mock('../offline-membership-helpers', () => ({
  reconcileOfflineHierarchyForBaseGroup: async () => ({
    affectedGroupIds: mocks.offlineHierarchy,
  }),
  recomputeOfflineSiblingMembershipsForGroup: async () => mocks.offlineSibling,
}));
vi.mock('../membership-helpers', () => ({
  loadGroupWithDerivedNetworkMeta: vi.fn(),
  recomputeSiblingMembershipsForGroup: async () => mocks.sibling,
}));
vi.mock('../../events/assembly-reconcile', () => ({
  reconcileGeneralAssemblyParticipantsForGroups: mocks.assembly,
}));
vi.mock('../../events/delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForGroups: mocks.allocations,
}));

import { groupServerMutatorInternals as helpers } from '../server-mutators';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      group_membership_role: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.graphAffected = ['graph'];
  mocks.offlineHierarchy = ['offline'];
  mocks.sibling = ['sibling'];
  mocks.offlineSibling = ['offline-sibling'];
  mocks.reconcileGraph.mockImplementation(async (_tx, args) => ({
    affectedGroupIds: args.reason === 'group-membership-hierarchy' ? mocks.graphAffected : [],
  }));
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('group server mutator internals', () => {
  it('adds, reuses, and synchronizes membership-role links', async () => {
    const existing = createTx();
    existing.run.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      helpers.addGroupMembershipRoleLink(existing, {
        group_membership_id: 'membership',
        role_id: 'role',
      })
    ).resolves.toBe('existing');

    const inserted = createTx();
    inserted.run.mockResolvedValueOnce(null);
    await expect(
      helpers.addGroupMembershipRoleLink(inserted, {
        group_membership_id: 'membership',
        role_id: 'role',
        assigned_by_id: 'actor',
      })
    ).resolves.toBe('uuid-1');
    expect(inserted.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: 'actor' })
    );
    const noActor = createTx();
    noActor.run.mockResolvedValueOnce(null);
    await helpers.addGroupMembershipRoleLink(noActor, {
      group_membership_id: 'membership',
      role_id: 'role',
    });
    expect(noActor.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );

    const synced = createTx();
    synced.run
      .mockResolvedValueOnce([
        { id: 'keep-link', role_id: 'keep' },
        { id: 'remove-link', role_id: 'remove' },
      ])
      .mockResolvedValueOnce(null);
    await helpers.syncGroupMembershipRoleLinks(synced, {
      group_membership_id: 'membership',
      role_ids: ['', 'keep', 'add', 'add'],
    });
    expect(synced.mutate.group_membership_role.delete).toHaveBeenCalledWith({ id: 'remove-link' });
    expect(synced.mutate.group_membership_role.insert).toHaveBeenCalledOnce();
  });

  it('compares role sets and normalizes link ids and summaries', async () => {
    expect(helpers.sameStringSet(['a'], ['a', 'b'])).toBe(false);
    expect(helpers.sameStringSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(helpers.sameStringSet(['a'], ['b'])).toBe(false);

    const membershipTx = createTx();
    membershipTx.run.mockResolvedValueOnce([{ role_id: 'a' }, { role_id: '' }, { role_id: null }]);
    await expect(helpers.groupMembershipRoleIds(membershipTx, 'membership')).resolves.toEqual([
      'a',
    ]);
    const guestTx = createTx();
    guestTx.run.mockResolvedValueOnce([{ role_id: 'g' }, { role_id: null }]);
    await expect(helpers.groupGuestRoleIds(guestTx, 'guest')).resolves.toEqual(['g']);

    await expect(helpers.roleSummary(createTx(), [], 'Fallback')).resolves.toBe('Fallback');
    await expect(helpers.roleSummary(createTx(), ['a', 'b'])).resolves.toBe('Role a, Role b');
  });

  it('notifies only changed active membership and guest role sets', async () => {
    const inactive = createTx();
    await helpers.notifyActiveMembershipRoleChange(
      inactive,
      'actor',
      { id: 'membership', group_id: 'group', user_id: 'user', status: 'inactive' },
      []
    );
    expect(inactive.run).not.toHaveBeenCalled();

    const same = createTx();
    same.run.mockResolvedValueOnce([{ role_id: 'b' }, { role_id: 'a' }]);
    await helpers.notifyActiveMembershipRoleChange(
      same,
      'actor',
      { id: 'membership', group_id: 'group', user_id: 'user', status: 'active' },
      ['a', 'b']
    );
    expect(mocks.notify).not.toHaveBeenCalled();

    const changed = createTx();
    changed.run.mockResolvedValueOnce([{ role_id: 'new' }]);
    await helpers.notifyActiveMembershipRoleChange(
      changed,
      'actor',
      { id: 'membership', group_id: 'group', user_id: 'user', status: 'member' },
      ['old']
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      'notifyMembershipRoleChanged',
      expect.objectContaining({ newRole: 'Role new' })
    );

    const guestInactive = createTx();
    await helpers.notifyActiveGuestAccessRoleChange(
      guestInactive,
      'actor',
      { id: 'guest', group_id: 'group', user_id: 'user', status: 'invited' },
      []
    );
    const guestSame = createTx();
    guestSame.run.mockResolvedValueOnce([]);
    await helpers.notifyActiveGuestAccessRoleChange(
      guestSame,
      'actor',
      { id: 'guest', group_id: 'group', user_id: 'user', status: 'active' },
      []
    );
    const guestChanged = createTx();
    guestChanged.run.mockResolvedValueOnce([]);
    await helpers.notifyActiveGuestAccessRoleChange(
      guestChanged,
      'actor',
      { id: 'guest', group_id: 'group', user_id: 'user', status: 'active' },
      ['old']
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      'notifyGuestAccessRoleChanged',
      expect.objectContaining({ newRole: 'Guest' })
    );
  });

  it('loads full and absent blog role notification context', async () => {
    const full = createTx();
    full.run
      .mockResolvedValueOnce({ group_id: 'group' })
      .mockResolvedValueOnce({ user_id: 'owner' });
    await expect(helpers.loadBlogRoleNotificationContext(full, 'blog')).resolves.toEqual({
      blogTitle: 'Blog title',
      groupId: 'group',
      ownerId: 'owner',
    });
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(helpers.loadBlogRoleNotificationContext(absent, 'blog')).resolves.toEqual({
      blogTitle: 'Blog title',
      groupId: undefined,
      ownerId: undefined,
    });
  });

  it('reconciles hierarchy, sibling, counter, and event effects with deduplication', async () => {
    const tx = createTx();
    const hierarchy = await helpers.reconcileBaseGroupHierarchyMemberships(
      tx,
      ['', 'base', 'base'],
      'actor'
    );
    expect([...hierarchy]).toEqual(expect.arrayContaining(['graph', 'offline']));

    const sibling = await helpers.recomputeSiblingMembershipsForGroups(
      tx,
      ['', 'group', 'group'],
      'actor'
    );
    expect([...sibling]).toEqual(expect.arrayContaining(['sibling', 'offline-sibling']));

    const expanded = await helpers.expandAffectedGroupsWithSiblingMemberships(
      tx,
      ['', 'group'],
      null
    );
    expect([...expanded]).toEqual(expect.arrayContaining(['group', 'sibling', 'offline-sibling']));

    await helpers.recomputeGroupCountersForGroups(tx, ['', 'group', 'group']);
    expect(mocks.groupCounter).toHaveBeenCalledOnce();

    await helpers.reconcileMembershipDrivenEventsForGroups(tx, []);
    expect(mocks.assembly).not.toHaveBeenCalled();
    await helpers.reconcileMembershipDrivenEventsForGroups(tx, ['', 'group', 'group'], 'actor');
    expect(mocks.assembly).toHaveBeenCalledWith(tx, ['group'], 'actor');
    expect(mocks.allocations).toHaveBeenCalledWith(tx, ['group']);
    expect(mocks.reconcileGraph).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ reason: 'group-membership-event-reconcile' })
    );
  });
});
