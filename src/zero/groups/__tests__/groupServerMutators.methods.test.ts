import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const shared = Object.fromEntries(
    [
      'create',
      'createOfflineMember',
      'updateOfflineMember',
      'deleteOfflineMember',
      'importOfflineMembers',
      'joinGroup',
      'inviteMember',
      'addMembershipRole',
      'removeMembershipRole',
      'syncMembershipRoles',
      'addOfflineMembershipRole',
      'removeOfflineMembershipRole',
      'syncOfflineMembershipRoles',
      'requestGuestAccess',
      'inviteGuest',
      'acceptGuestInvitation',
      'revokeGuestAccess',
      'addGuestRole',
      'removeGuestRole',
      'syncGuestRoles',
      'acceptInvitation',
      'leaveGroup',
      'updateMembership',
      'update',
      'createRole',
      'deleteRole',
      'assignActionRight',
      'removeActionRight',
      'createRoleHolderHistory',
      'updateRoleHolderHistory',
    ].map(name => [name, { fn: vi.fn(async () => undefined) }])
  ) as Record<string, { fn: ReturnType<typeof vi.fn> }>;
  return {
    shared,
    notify: vi.fn(),
    conflict: vi.fn(async () => ({ blocking: false, conflicts: [] })),
    groupMeta: { group_type: 'base' } as Record<string, any> | null,
    roleInfo: {} as Record<string, Record<string, any>>,
    groupName: vi.fn(async (_tx: unknown, id: string) => `Group ${id}`),
    userName: vi.fn(async (_tx: unknown, id: string) => ({ name: `User ${id}` })),
    ensureConversation: vi.fn(),
    groupCounter: vi.fn(),
    userCounter: vi.fn(),
    syncConversation: vi.fn(),
    graph: vi.fn(async () => ({ affectedGroupIds: ['graph'] })),
    offlineHierarchy: ['offline'] as string[],
    sibling: ['sibling'] as string[],
    offlineSibling: ['offline-sibling'] as string[],
    assembly: vi.fn(),
    allocations: vi.fn(),
    hashtags: vi.fn(),
    connection: vi.fn(async () => undefined),
    eventCreate: vi.fn(async () => undefined),
  };
});

vi.mock('../../mutators', () => ({ mutators: { groups: mocks.shared } }));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.notify }));
vi.mock('@/server/group-conflict-validation', () => ({
  assertNoBlockingGroupConflicts: mocks.conflict,
}));
vi.mock('../../server-helpers', () => ({
  amendmentTitle: async (_tx: unknown, id: string) => `Amendment ${id}`,
  blogTitle: async (_tx: unknown, id: string) => `Blog ${id}`,
  eventTitle: async (_tx: unknown, id: string) => `Event ${id}`,
  groupName: mocks.groupName,
  userName: mocks.userName,
  roleName: async (_tx: unknown, id: string) =>
    mocks.roleInfo[id] ?? { name: `Role ${id}`, groupId: undefined, blogId: undefined },
  isActiveGroupStatus: (status: string) => ['active', 'member', 'admin'].includes(status),
  ensureGroupConversation: mocks.ensureConversation,
  recomputeGroupCounters: mocks.groupCounter,
  recomputeUserCounters: mocks.userCounter,
  syncUserWithGroupConversation: mocks.syncConversation,
}));
vi.mock('../../rbac/constants', () => ({
  DEFAULT_GROUP_ROLES: [
    {
      name: 'Admin',
      description: 'Admin',
      default_request_role: false,
      default_invite_role: false,
      permissions: [{ resource: 'groups', action: 'manage' }],
    },
    {
      name: 'Member',
      description: 'Member',
      default_request_role: true,
      default_invite_role: true,
      permissions: [],
    },
  ],
}));
vi.mock('../../events/server-mutators', () => ({
  eventServerMutators: { create: { fn: mocks.eventCreate } },
}));
vi.mock('../../network/server-mutators', () => ({
  networkServerMutators: { proposeGroupConnectionChange: { fn: mocks.connection } },
}));
vi.mock('../membership-helpers', () => ({
  loadGroupWithDerivedNetworkMeta: async () => mocks.groupMeta,
  recomputeSiblingMembershipsForGroup: async () => mocks.sibling,
}));
vi.mock('../offline-membership-helpers', () => ({
  reconcileOfflineHierarchyForBaseGroup: async () => ({
    affectedGroupIds: mocks.offlineHierarchy,
  }),
  recomputeOfflineSiblingMembershipsForGroup: async () => mocks.offlineSibling,
}));
vi.mock('../../events/assembly-reconcile', () => ({
  reconcileGeneralAssemblyParticipantsForGroups: mocks.assembly,
}));
vi.mock('../../events/delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForGroups: mocks.allocations,
}));
vi.mock('../../network/group-graph-reconcile', () => ({
  reconcileGroupGraph: mocks.graph,
}));
vi.mock('../../common/server-hashtags', () => ({
  syncEntityHashtagsForCreate: mocks.hashtags,
}));

import { groupServerMutators as mutators } from '../server-mutators';

function table() {
  return { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      role: table(),
      action_right: table(),
      group_membership: table(),
      group_membership_role: table(),
    },
  } as any;
}

const ctx = { userID: 'actor', email: 'actor@example.test' } as never;

function membershipArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership',
    group_id: 'group',
    user_id: 'user',
    status: 'requested',
    visibility: '',
    ...overrides,
  } as never;
}

function guestArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest',
    group_id: 'group',
    user_id: 'user',
    status: 'invited',
    role_ids: ['role'],
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of Object.values(mocks.shared)) {
    method.fn.mockImplementation(async () => undefined);
  }
  mocks.groupMeta = { group_type: 'base' };
  mocks.roleInfo = {};
  mocks.offlineHierarchy = ['offline'];
  mocks.sibling = ['sibling'];
  mocks.offlineSibling = ['offline-sibling'];
  mocks.graph.mockResolvedValue({ affectedGroupIds: ['graph'] });
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('group server creation and offline-member effects', () => {
  it('creates default roles, rights, creator membership, conversation, counters, and graph', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await mutators.create.fn({
      tx,
      ctx,
      args: { id: 'group', name: 'Group', group_type: 'base' } as never,
    });
    expect(mocks.shared.create.fn).toHaveBeenCalled();
    expect(tx.mutate.role.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Member', visibility: 'private' })
    );
    expect(tx.mutate.action_right.insert).toHaveBeenCalledOnce();
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledOnce();
    expect(tx.mutate.group_membership_role.insert).toHaveBeenCalledOnce();
    expect(mocks.ensureConversation).toHaveBeenCalled();
    expect(mocks.syncConversation).toHaveBeenCalled();
  });

  it('creates full groups with empty and populated optional collections', async () => {
    const empty = createTx();
    empty.run.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await mutators.createFull.fn({
      tx: empty,
      ctx,
      args: { group: { id: 'group', name: 'Group' }, hashtags: [] } as never,
    });
    expect(mocks.hashtags).toHaveBeenCalled();

    const full = createTx();
    full.run.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await mutators.createFull.fn({
      tx: full,
      ctx,
      args: {
        group: { id: 'group', name: 'Group' },
        hashtags: ['tag'],
        official_invite_user_ids: ['official'],
        guest_invite_user_ids: ['guest-a', 'guest-b'],
        connection_requests: [{ id: 'connection' }],
        founding_event: { id: 'event' },
      } as never,
    });
    expect(mocks.shared.inviteMember.fn).toHaveBeenCalledOnce();
    expect(mocks.shared.createRole.fn).toHaveBeenCalledOnce();
    expect(mocks.shared.inviteGuest.fn).toHaveBeenCalledTimes(2);
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.eventCreate).toHaveBeenCalledOnce();
  });

  it('reconciles create/import and conditionally update/delete offline effects', async () => {
    for (const method of [mutators.createOfflineMember, mutators.importOfflineMembers]) {
      const tx = createTx();
      await method.fn({
        tx,
        ctx,
        args:
          method === mutators.createOfflineMember
            ? ({ id: 'offline', group_id: 'group' } as never)
            : ({ group_id: 'group', entries: [] } as never),
      });
      expect(mocks.groupCounter).toHaveBeenCalled();
    }

    for (const method of [mutators.updateOfflineMember, mutators.deleteOfflineMember]) {
      const absent = createTx();
      absent.run.mockResolvedValueOnce(null);
      await method.fn({ tx: absent, ctx, args: { id: 'offline' } as never });
      const present = createTx();
      present.run.mockResolvedValueOnce({ id: 'offline', group_id: 'group' });
      await method.fn({ tx: present, ctx, args: { id: 'offline' } as never });
    }
  });
});

describe('group server membership effects', () => {
  it('handles requested, active base, active non-base, and inactive joins', async () => {
    const cases = [
      { group: null, status: 'requested', notification: 'notifyMembershipRequest' },
      { group: { group_type: 'base' }, status: 'active' },
      { group: { group_type: 'sibling' }, status: 'active' },
      { group: { group_type: 'base' }, status: 'invited' },
    ];
    for (const item of cases) {
      mocks.groupMeta = item.group;
      const tx = createTx();
      await mutators.joinGroup.fn({ tx, ctx, args: membershipArgs({ status: item.status }) });
      if (item.notification) {
        expect(mocks.notify).toHaveBeenCalledWith(item.notification, expect.anything());
      }
    }
    expect(mocks.conflict).toHaveBeenCalledTimes(cases.length);
  });

  it('notifies only complete official member invitations', async () => {
    await mutators.inviteMember.fn({
      tx: createTx(),
      ctx,
      args: membershipArgs({ user_id: null }),
    });
    expect(mocks.notify).not.toHaveBeenCalled();
    await mutators.inviteMember.fn({ tx: createTx(), ctx, args: membershipArgs() });
    expect(mocks.notify).toHaveBeenCalledWith('notifyGroupInvite', expect.anything());
  });

  it('runs present and absent official/offline role effect wrappers', async () => {
    const officialMethods = [
      mutators.addMembershipRole,
      mutators.removeMembershipRole,
      mutators.syncMembershipRoles,
    ];
    for (const method of officialMethods) {
      const absent = createTx();
      absent.run.mockResolvedValueOnce(null);
      await method.fn({
        tx: absent,
        ctx,
        args: { group_membership_id: 'membership', role_id: 'role', role_ids: [] } as never,
      });
      const present = createTx();
      present.run
        .mockResolvedValueOnce({
          id: 'membership',
          group_id: 'group',
          user_id: 'user',
          status: 'inactive',
        })
        .mockResolvedValueOnce([{ role_id: 'old' }]);
      await method.fn({
        tx: present,
        ctx,
        args: { group_membership_id: 'membership', role_id: 'role', role_ids: [] } as never,
      });
    }

    const offlineMethods = [
      mutators.addOfflineMembershipRole,
      mutators.removeOfflineMembershipRole,
      mutators.syncOfflineMembershipRoles,
    ];
    for (const method of offlineMethods) {
      const absent = createTx();
      absent.run.mockResolvedValueOnce(null);
      await method.fn({
        tx: absent,
        ctx,
        args: { group_offline_membership_id: 'membership', role_id: 'role', role_ids: [] } as never,
      });
      const present = createTx();
      present.run.mockResolvedValueOnce({ id: 'membership', group_id: 'group' });
      await method.fn({
        tx: present,
        ctx,
        args: { group_offline_membership_id: 'membership', role_id: 'role', role_ids: [] } as never,
      });
    }
  });

  it('accepts absent, non-base, and base invitations', async () => {
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null);
    await mutators.acceptInvitation.fn({ tx: absent, ctx, args: { id: 'membership' } });

    for (const group of [null, { group_type: 'sibling' }, { group_type: 'base' }]) {
      mocks.groupMeta = group;
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'membership', group_id: 'group', user_id: 'user' });
      await mutators.acceptInvitation.fn({ tx, ctx, args: { id: 'membership' } });
    }
  });

  it('emits every leave notification and handles direct/derived/absent membership effects', async () => {
    const variants = [
      {
        user_id: 'actor',
        status: 'requested',
        source: 'direct',
        event: 'notifyGroupRequestWithdrawn',
      },
      {
        user_id: 'actor',
        status: 'invited',
        source: 'direct',
        event: 'notifyGroupInvitationDeclined',
      },
      { user_id: 'actor', status: 'active', source: 'direct', event: 'notifyMembershipWithdrawn' },
      {
        user_id: 'other',
        status: 'requested',
        source: 'hierarchy',
        event: 'notifyMembershipRejected',
      },
      { user_id: 'other', status: 'active', source: 'hierarchy', event: 'notifyMembershipRemoved' },
    ];
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null);
    await mutators.leaveGroup.fn({ tx: absent, ctx, args: { id: 'membership' } });
    for (const variant of variants) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'membership', group_id: 'group', ...variant });
      await mutators.leaveGroup.fn({ tx, ctx, args: { id: 'membership' } });
      expect(mocks.notify).toHaveBeenCalledWith(variant.event, expect.anything());
    }
  });

  it('covers every membership status transition and reconciliation boundary', async () => {
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null);
    await mutators.updateMembership.fn({ tx: absent, ctx, args: { id: 'membership' } });

    const variants = [
      {
        old: 'requested',
        next: 'active',
        user: 'actor',
        group: { group_type: 'base' },
        event: 'notifyGroupInvitationAccepted',
      },
      {
        old: 'invited',
        next: 'active',
        user: 'other',
        group: { group_type: 'sibling' },
        event: 'notifyMembershipApproved',
      },
      { old: 'active', next: 'admin', user: 'other', group: null, event: 'notifyAdminPromoted' },
      { old: 'admin', next: 'active', user: 'other', group: null, event: 'notifyAdminDemoted' },
      { old: 'active', next: 'inactive', user: 'other', group: { group_type: 'base' } },
      { old: 'inactive', next: undefined, user: 'other', group: null },
    ];
    for (const variant of variants) {
      mocks.groupMeta = variant.group;
      const tx = createTx();
      tx.run.mockResolvedValueOnce({
        id: 'membership',
        group_id: 'group',
        user_id: variant.user,
        status: variant.old,
      });
      await mutators.updateMembership.fn({
        tx,
        ctx,
        args: {
          id: 'membership',
          ...(variant.next === undefined ? {} : { status: variant.next }),
        } as never,
      });
      if (variant.event)
        expect(mocks.notify).toHaveBeenCalledWith(variant.event, expect.anything());
    }
  });
});

describe('group server guest access effects', () => {
  it('notifies guest requests and conditionally guest invitations/active conversation sync', async () => {
    await mutators.requestGuestAccess.fn({ tx: createTx(), ctx, args: guestArgs() });
    expect(mocks.notify).toHaveBeenCalledWith('notifyGuestAccessRequest', expect.anything());

    await mutators.inviteGuest.fn({
      tx: createTx(),
      ctx,
      args: guestArgs({ user_id: null, status: 'invited' }),
    });
    await mutators.inviteGuest.fn({ tx: createTx(), ctx, args: guestArgs({ status: 'active' }) });
    expect(mocks.notify).toHaveBeenCalledWith('notifyGuestAccessInvite', expect.anything());
    expect(mocks.syncConversation).toHaveBeenCalled();
  });

  it('accepts absent, self, and admin-approved guest invitations', async () => {
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null);
    await mutators.acceptGuestInvitation.fn({ tx: absent, ctx, args: { id: 'guest' } });
    for (const userId of ['actor', 'other']) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'guest', group_id: 'group', user_id: userId });
      await mutators.acceptGuestInvitation.fn({ tx, ctx, args: { id: 'guest' } });
    }
    expect(mocks.notify).toHaveBeenCalledWith('notifyGroupInvitationAccepted', expect.anything());
    expect(mocks.notify).toHaveBeenCalledWith('notifyGuestAccessApproved', expect.anything());
  });

  it('emits every guest revocation notification', async () => {
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null);
    await mutators.revokeGuestAccess.fn({ tx: absent, ctx, args: { id: 'guest' } });
    const variants = [
      { user_id: 'actor', status: 'requested', event: 'notifyGroupRequestWithdrawn' },
      { user_id: 'actor', status: 'invited', event: 'notifyGroupInvitationDeclined' },
      { user_id: 'actor', status: 'active', event: 'notifyGuestAccessWithdrawn' },
      { user_id: 'other', status: 'requested', event: 'notifyMembershipRejected' },
      { user_id: 'other', status: 'active', event: 'notifyGuestAccessRemoved' },
    ];
    for (const variant of variants) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'guest', group_id: 'group', ...variant });
      await mutators.revokeGuestAccess.fn({ tx, ctx, args: { id: 'guest' } });
      expect(mocks.notify).toHaveBeenCalledWith(variant.event, expect.anything());
    }
  });

  it('runs absent and present guest role notification wrappers', async () => {
    for (const method of [
      mutators.addGuestRole,
      mutators.removeGuestRole,
      mutators.syncGuestRoles,
    ]) {
      const absent = createTx();
      absent.run.mockResolvedValueOnce(null);
      await method.fn({
        tx: absent,
        ctx,
        args: { group_guest_access_id: 'guest', role_id: 'role', role_ids: [] } as never,
      });
      const present = createTx();
      present.run
        .mockResolvedValueOnce({
          id: 'guest',
          group_id: 'group',
          user_id: 'user',
          status: 'inactive',
        })
        .mockResolvedValueOnce([{ role_id: 'old' }]);
      await method.fn({
        tx: present,
        ctx,
        args: { group_guest_access_id: 'guest', role_id: 'role', role_ids: [] } as never,
      });
    }
  });
});

describe('group server profile, role, right, and history notifications', () => {
  it('updates group profiles with explicit and loaded names', async () => {
    await mutators.update.fn({
      tx: createTx(),
      ctx,
      args: { id: 'group', name: 'Explicit' } as never,
    });
    await mutators.update.fn({ tx: createTx(), ctx, args: { id: 'group' } as never });
    expect(mocks.groupName).toHaveBeenCalled();
  });

  it('creates and deletes group, blog, and unscoped roles', async () => {
    await mutators.createRole.fn({
      tx: createTx(),
      ctx,
      args: { id: 'role', name: 'Role', group_id: 'group' } as never,
    });
    const blogCreate = createTx();
    blogCreate.run
      .mockResolvedValueOnce({ group_id: 'group' })
      .mockResolvedValueOnce({ user_id: 'owner' });
    await mutators.createRole.fn({
      tx: blogCreate,
      ctx,
      args: { id: 'role', name: 'Role', blog_id: 'blog' } as never,
    });
    await mutators.createRole.fn({
      tx: createTx(),
      ctx,
      args: { id: 'role', name: 'Role' } as never,
    });

    mocks.roleInfo.group = { name: 'Group role', groupId: 'group' };
    await mutators.deleteRole.fn({ tx: createTx(), ctx, args: { id: 'group' } });
    mocks.roleInfo.blog = { name: 'Blog role', blogId: 'blog' };
    const blogDelete = createTx();
    blogDelete.run.mockResolvedValueOnce({ group_id: null }).mockResolvedValueOnce(null);
    await mutators.deleteRole.fn({ tx: blogDelete, ctx, args: { id: 'blog' } });
    mocks.roleInfo.none = { name: 'None' };
    await mutators.deleteRole.fn({ tx: createTx(), ctx, args: { id: 'none' } });
  });

  it('notifies every assigned and removed action-right scope plus no-scope paths', async () => {
    const scopes = [
      { group_id: 'group', event: 'notifyActionRightsChanged' },
      { event_id: 'event', event: 'notifyEventRoleUpdated' },
      { amendment_id: 'amendment', event: 'notifyAmendmentRoleUpdated' },
      { blog_id: 'blog', event: 'notifyBlogRoleUpdated' },
      {},
    ];
    for (const scope of scopes) {
      const tx = createTx();
      if ('blog_id' in scope) {
        tx.run.mockResolvedValueOnce({ group_id: null }).mockResolvedValueOnce(null);
      }
      await mutators.assignActionRight.fn({
        tx,
        ctx,
        args: { id: 'right', role_id: 'role', ...scope } as never,
      });
      if (scope.event) expect(mocks.notify).toHaveBeenCalledWith(scope.event, expect.anything());
    }

    const removedScopes = [
      { role_id: 'role', group_id: 'group', event: 'notifyActionRightsChanged' },
      { role_id: 'role', event_id: 'event', event: 'notifyEventRoleUpdated' },
      { role_id: 'role', amendment_id: 'amendment', event: 'notifyAmendmentRoleUpdated' },
      { role_id: 'role', blog_id: 'blog', event: 'notifyBlogRoleUpdated' },
      { role_id: null },
      null,
    ];
    for (const right of removedScopes) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(right);
      if (right?.blog_id) {
        tx.run.mockResolvedValueOnce({ group_id: null }).mockResolvedValueOnce(null);
      }
      await mutators.removeActionRight.fn({ tx, ctx, args: { id: 'right' } });
      if (right?.event) expect(mocks.notify).toHaveBeenCalledWith(right.event, expect.anything());
    }
  });

  it('notifies assigned and vacated role holders only with complete context', async () => {
    const assigned = createTx();
    assigned.run.mockResolvedValueOnce({ id: 'role', group_id: 'group', name: 'Role' });
    await mutators.createRoleHolderHistory.fn({
      tx: assigned,
      ctx,
      args: { id: 'history', role_id: 'role', user_id: 'user' } as never,
    });
    for (const args of [
      { id: 'history', role_id: null, user_id: 'user' },
      { id: 'history', role_id: 'role', user_id: null },
    ]) {
      const tx = createTx();
      if (args.role_id) tx.run.mockResolvedValueOnce(null);
      await mutators.createRoleHolderHistory.fn({ tx, ctx, args: args as never });
    }

    const vacated = createTx();
    vacated.run
      .mockResolvedValueOnce({ id: 'history', role_id: 'role', end_date: null })
      .mockResolvedValueOnce({ id: 'role', group_id: 'group', name: 'Role' });
    await mutators.updateRoleHolderHistory.fn({
      tx: vacated,
      ctx,
      args: { id: 'history', end_date: 1 } as never,
    });

    const noPosition = createTx();
    noPosition.run
      .mockResolvedValueOnce({ id: 'history', role_id: 'role', end_date: null })
      .mockResolvedValueOnce(null);
    await mutators.updateRoleHolderHistory.fn({
      tx: noPosition,
      ctx,
      args: { id: 'history', end_date: 1 } as never,
    });
    for (const pair of [
      [
        { id: 'history', role_id: 'role', end_date: 1 },
        { id: 'history', end_date: 2 },
      ],
      [
        { id: 'history', role_id: null, end_date: null },
        { id: 'history', end_date: 2 },
      ],
      [
        { id: 'history', role_id: 'role', end_date: null },
        { id: 'history', end_date: 0 },
      ],
    ]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(pair[0]);
      await mutators.updateRoleHolderHistory.fn({ tx, ctx, args: pair[1] as never });
    }
  });
});
