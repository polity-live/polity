import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutatorMocks = vi.hoisted(() => ({
  updateMembership: vi.fn(),
}));
const membershipHelperMocks = vi.hoisted(() => ({
  loadGroupWithDerivedNetworkMeta: vi.fn(),
  recomputeSiblingMembershipsForGroup: vi.fn(),
}));
const offlineMembershipMocks = vi.hoisted(() => ({
  reconcileOfflineHierarchyForBaseGroup: vi.fn(),
  recomputeOfflineSiblingMembershipsForGroup: vi.fn(),
}));
const assemblyReconcileMocks = vi.hoisted(() => ({
  reconcileGeneralAssemblyParticipantsForGroups: vi.fn(),
}));
const delegateReconcileMocks = vi.hoisted(() => ({
  reconcileDelegateAllocationsForGroups: vi.fn(),
}));
const groupGraphMocks = vi.hoisted(() => ({
  reconcileGroupGraph: vi.fn(),
}));
const conflictValidationMocks = vi.hoisted(() => ({
  assertNoBlockingGroupConflicts: vi.fn(),
}));
const serverHelperMocks = vi.hoisted(() => ({
  amendmentTitle: vi.fn(),
  blogTitle: vi.fn(),
  eventTitle: vi.fn(),
  groupName: vi.fn(),
  userName: vi.fn(),
  roleName: vi.fn(),
  isActiveGroupStatus: vi.fn((status: string | null | undefined) =>
    ['active', 'admin', 'member'].includes(status ?? '')
  ),
  ensureGroupConversation: vi.fn(),
  recomputeGroupCounters: vi.fn(),
  recomputeUserCounters: vi.fn(),
  syncUserWithGroupConversation: vi.fn(),
}));
const serverNotifyMocks = vi.hoisted(() => ({
  fireNotification: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    groups: {
      updateMembership: { fn: mutatorMocks.updateMembership },
    },
  },
}));

vi.mock('../membership-helpers', () => membershipHelperMocks);

vi.mock('../offline-membership-helpers', () => offlineMembershipMocks);

vi.mock('../../events/assembly-reconcile', () => assemblyReconcileMocks);

vi.mock('../../events/delegate-allocation-reconcile', () => delegateReconcileMocks);

vi.mock('../../network/group-graph-reconcile', () => groupGraphMocks);

vi.mock('@/server/group-conflict-validation', () => conflictValidationMocks);

vi.mock('../../server-helpers', () => serverHelperMocks);

vi.mock('../../server-notify', () => serverNotifyMocks);

vi.mock('../../rbac/constants', () => ({
  DEFAULT_GROUP_ROLES: [],
}));

import { groupServerMutators } from '../server-mutators';

type GroupMutatorInput = Parameters<typeof groupServerMutators.updateMembership.fn>[0];
type GroupMutatorCtx = GroupMutatorInput['ctx'];

function createTx() {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'server' as const,
    run: vi.fn(),
    mutate: {},
  };
}

function createCtx(): GroupMutatorCtx {
  return {
    userID: 'admin-1',
    email: 'admin@example.com',
  };
}

beforeEach(() => {
  Object.values(mutatorMocks).forEach(mock => mock.mockReset());
  Object.values(membershipHelperMocks).forEach(mock => mock.mockReset());
  Object.values(offlineMembershipMocks).forEach(mock => mock.mockReset());
  Object.values(assemblyReconcileMocks).forEach(mock => mock.mockReset());
  Object.values(delegateReconcileMocks).forEach(mock => mock.mockReset());
  Object.values(groupGraphMocks).forEach(mock => mock.mockReset());
  Object.values(conflictValidationMocks).forEach(mock => mock.mockReset());
  Object.values(serverHelperMocks).forEach(mock => mock.mockReset());
  Object.values(serverNotifyMocks).forEach(mock => mock.mockReset());
  serverHelperMocks.isActiveGroupStatus.mockImplementation((status: string | null | undefined) =>
    ['active', 'admin', 'member'].includes(status ?? '')
  );
  serverHelperMocks.groupName.mockResolvedValue('Target group');
  serverHelperMocks.userName.mockResolvedValue('Member User');
  membershipHelperMocks.loadGroupWithDerivedNetworkMeta.mockResolvedValue({
    id: 'group-1',
    group_type: 'sibling',
  });
  membershipHelperMocks.recomputeSiblingMembershipsForGroup.mockResolvedValue(['linked-group']);
  offlineMembershipMocks.recomputeOfflineSiblingMembershipsForGroup.mockResolvedValue([]);
  offlineMembershipMocks.reconcileOfflineHierarchyForBaseGroup.mockResolvedValue({
    affectedGroupIds: new Set(),
  });
  assemblyReconcileMocks.reconcileGeneralAssemblyParticipantsForGroups.mockResolvedValue(undefined);
  delegateReconcileMocks.reconcileDelegateAllocationsForGroups.mockResolvedValue(undefined);
  groupGraphMocks.reconcileGroupGraph.mockResolvedValue({
    affectedGroupIds: new Set(),
    affectedUserIds: new Set(),
    affectedMembershipPairs: new Set(),
  });
  conflictValidationMocks.assertNoBlockingGroupConflicts.mockResolvedValue(undefined);
});

describe('groupServerMutators membership-driven event reconciliation', () => {
  it('reconciles general assembly invitations after a membership becomes active', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'membership-1',
        group_id: 'group-1',
        user_id: 'member-1',
        status: 'requested',
        source: 'direct',
      })
      .mockResolvedValueOnce([]);

    await groupServerMutators.updateMembership.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'membership-1',
        status: 'active',
      },
    });

    expect(conflictValidationMocks.assertNoBlockingGroupConflicts).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userID: 'admin-1' }),
      {
        kind: 'membership_activation',
        membership_id: 'membership-1',
      }
    );
    expect(
      assemblyReconcileMocks.reconcileGeneralAssemblyParticipantsForGroups
    ).toHaveBeenCalledWith(tx, ['group-1', 'linked-group'], 'admin-1');
  });

  it('does not reconcile or notify when membership activation preflight blocks the change', async () => {
    const tx = createTx();
    const conflictError = new Error('__GROUP_CONFLICT__:{"blocking":true,"conflicts":[]}');
    tx.run
      .mockResolvedValueOnce({
        id: 'membership-1',
        group_id: 'group-1',
        user_id: 'member-1',
        status: 'requested',
        source: 'direct',
      })
      .mockResolvedValueOnce([]);
    conflictValidationMocks.assertNoBlockingGroupConflicts.mockRejectedValueOnce(conflictError);

    await expect(
      groupServerMutators.updateMembership.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'membership-1',
          status: 'active',
        },
      })
    ).rejects.toBe(conflictError);

    expect(mutatorMocks.updateMembership).not.toHaveBeenCalled();
    expect(
      assemblyReconcileMocks.reconcileGeneralAssemblyParticipantsForGroups
    ).not.toHaveBeenCalled();
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalled();
  });
});
