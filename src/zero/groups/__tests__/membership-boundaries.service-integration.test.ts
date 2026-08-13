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
    request: {} as Request | undefined,
    getSession: vi.fn(),
    createContext: vi.fn((userID: string, email: string) => ({ userID, email })),
    executeRead: vi.fn(async (callback: (tx: object) => unknown) => callback({ id: 'read-tx' })),
    resolvePreflight: vi.fn(),
    assertNoConflict: vi.fn(async () => undefined),
    notify: vi.fn(async () => undefined),
    shared,
    recomputeGroup: vi.fn(),
    recomputeUser: vi.fn(),
    assembly: vi.fn(),
    allocations: vi.fn(),
    graph: vi.fn(async () => ({ affectedGroupIds: [] })),
  };
});

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const chain = {
      validator(next: (value: unknown) => unknown) {
        validator = next;
        return chain;
      },
      handler(handler: (input: any) => unknown) {
        return (input: any) => handler({ ...input, data: validator(input.data) });
      },
    };
    return chain;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => mocks.request }));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: mocks.createContext,
  executeZeroRead: mocks.executeRead,
}));
vi.mock('@/server/group-conflict-validation', () => ({
  resolveGroupConflictPreflight: mocks.resolvePreflight,
  assertNoBlockingGroupConflicts: mocks.assertNoConflict,
}));
vi.mock('../../mutators', () => ({ mutators: { groups: mocks.shared } }));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.notify }));
vi.mock('../../server-helpers', () => ({
  amendmentTitle: async (_tx: unknown, id: string) => `Amendment ${id}`,
  blogTitle: async (_tx: unknown, id: string) => `Blog ${id}`,
  eventTitle: async (_tx: unknown, id: string) => `Event ${id}`,
  groupName: async (_tx: unknown, id: string) => `Group ${id}`,
  userName: async (_tx: unknown, id: string) => ({ name: `User ${id}` }),
  roleName: async (_tx: unknown, id: string) => ({ name: `Role ${id}` }),
  isActiveGroupStatus: (status: string | null | undefined) =>
    status === 'active' || status === 'admin' || status === 'member',
  ensureGroupConversation: vi.fn(),
  recomputeGroupCounters: mocks.recomputeGroup,
  recomputeUserCounters: mocks.recomputeUser,
  syncUserWithGroupConversation: vi.fn(),
}));
vi.mock('../../rbac/constants', () => ({ DEFAULT_GROUP_ROLES: [] }));
vi.mock('../../events/server-mutators', () => ({
  eventServerMutators: { create: { fn: vi.fn() } },
}));
vi.mock('../../network/server-mutators', () => ({
  networkServerMutators: { proposeGroupConnectionChange: { fn: vi.fn() } },
}));
vi.mock('../membership-helpers', () => ({
  loadGroupWithDerivedNetworkMeta: vi.fn(async () => ({ group_type: 'base' })),
  recomputeSiblingMembershipsForGroup: vi.fn(async () => []),
}));
vi.mock('../offline-membership-helpers', () => ({
  reconcileOfflineHierarchyForBaseGroup: vi.fn(async () => ({ affectedGroupIds: [] })),
  recomputeOfflineSiblingMembershipsForGroup: vi.fn(async () => []),
}));
vi.mock('../../events/assembly-reconcile', () => ({
  reconcileGeneralAssemblyParticipantsForGroups: mocks.assembly,
}));
vi.mock('../../events/delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForGroups: mocks.allocations,
}));
vi.mock('../../network/group-graph-reconcile', () => ({ reconcileGroupGraph: mocks.graph }));
vi.mock('../../common/server-hashtags', () => ({ syncEntityHashtagsForCreate: vi.fn() }));

import { groupConflictPreflightFn } from '@/server/group-conflict-preflight';
import {
  buildGroupConflictResponse,
  parseGroupConflictResponseMessage,
  throwGroupConflictResponse,
} from '@/features/groups/logic/groupConflict';
import { groupServerMutators } from '../server-mutators';

const preflightInput = {
  kind: 'membership_activation' as const,
  membership_id: 'membership-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request = new Request('http://localhost/group/membership/preflight');
  mocks.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.test' } });
  mocks.resolvePreflight.mockResolvedValue({ blocking: false, conflicts: [] });
});

describe('membership service boundaries', () => {
  it('validates an authenticated preflight before invoking the conflict service', async () => {
    await expect((groupConflictPreflightFn as any)({ data: preflightInput })).resolves.toEqual({
      blocking: false,
      conflicts: [],
    });
    expect(mocks.createContext).toHaveBeenCalledWith('admin-1', 'admin@example.test');
    expect(mocks.resolvePreflight).toHaveBeenCalledWith(
      { id: 'read-tx' },
      expect.objectContaining({ userID: 'admin-1' }),
      preflightInput
    );
  });

  it('preserves the stable structured conflict error across the server-function boundary', async () => {
    const response = buildGroupConflictResponse([
      {
        kind: 'hierarchy_member_overlap',
        blocking: true,
        summary: 'Membership overlaps another subgroup',
        explanation: 'The actor already belongs to an exclusive branch.',
        details: { users: [], groups: [], source_groups: [], paths: [] },
        resolutions: [
          {
            code: 'leave_other_subgroup',
            label: 'Leave other subgroup',
            description: 'Resolve the exclusive membership first.',
            self_service: true,
          },
        ],
      },
    ]);
    mocks.resolvePreflight.mockImplementation(() => throwGroupConflictResponse(response));
    const error = await (groupConflictPreflightFn as any)({ data: preflightInput }).catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(Error);
    expect(parseGroupConflictResponseMessage((error as Error).message)).toEqual(response);
  });

  it('approves a requested membership and emits the recipient notification after mutation', async () => {
    const membership = {
      id: 'membership-1',
      group_id: 'group-1',
      user_id: 'member-1',
      status: 'requested',
    };
    const tx = {
      run: vi.fn(async () => membership),
      mutate: {},
    } as any;
    await groupServerMutators.updateMembership.fn({
      tx,
      ctx: { userID: 'admin-1', email: 'admin@example.test' } as never,
      args: { id: membership.id, status: 'active' } as never,
    });
    expect(mocks.assertNoConflict).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userID: 'admin-1' }),
      { kind: 'membership_activation', membership_id: 'membership-1' }
    );
    expect(mocks.shared.updateMembership.fn).toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith('notifyMembershipApproved', {
      senderId: 'admin-1',
      recipientUserId: 'member-1',
      groupId: 'group-1',
      groupName: 'Group group-1',
    });
  });
});
