import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const helperMocks = vi.hoisted(() => ({
  approveGroupConnectionRequest: vi.fn(),
  deleteGroupConnectionAndRequests: vi.fn(),
  proposeGroupConnectionChange: vi.fn(),
  rejectGroupConnectionRequest: vi.fn(),
}));
const groupHelperMocks = vi.hoisted(() => ({
  buildGroupsById: vi.fn(),
  loadGroupWithDerivedNetworkMeta: vi.fn(),
  recomputeSiblingGroupMemberships: vi.fn(),
}));
const offlineGroupHelperMocks = vi.hoisted(() => ({
  reconcileOfflineHierarchyForBaseGroup: vi.fn(),
}));
const graphMocks = vi.hoisted(() => ({
  reconcileGroupGraph: vi.fn(),
}));
const conflictValidationMocks = vi.hoisted(() => ({
  assertNoBlockingGroupConflicts: vi.fn(),
}));
const serverNotifyMocks = vi.hoisted(() => ({
  fireNotification: vi.fn(),
}));
const serverHelperMocks = vi.hoisted(() => ({
  groupName: vi.fn(),
  recomputeGroupCounters: vi.fn(),
  recomputeUserCounters: vi.fn(),
  syncUserWithGroupConversation: vi.fn(),
}));
const assemblyReconcileMocks = vi.hoisted(() => ({
  reconcileGeneralAssemblyParticipantsForGroups: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    network: {
      createGroupConnection: { fn: vi.fn() },
      updateGroupConnection: { fn: vi.fn() },
    },
  },
}));

vi.mock('../mutator-helpers', () => helperMocks);

vi.mock('../../groups/membership-helpers', () => groupHelperMocks);

vi.mock('../../groups/offline-membership-helpers', () => offlineGroupHelperMocks);

vi.mock('../group-graph-reconcile', () => graphMocks);

vi.mock('@/server/group-conflict-validation', () => conflictValidationMocks);

vi.mock('../../server-notify', () => serverNotifyMocks);

vi.mock('../../server-helpers', () => serverHelperMocks);

vi.mock('../../events/delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForGroups: vi.fn(),
}));

vi.mock('../../events/assembly-reconcile', () => assemblyReconcileMocks);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { networkServerMutators } from '../server-mutators';

type NetworkMutatorInput = Parameters<typeof networkServerMutators.deleteGroupConnection.fn>[0];
type NetworkMutatorTx = NetworkMutatorInput['tx'];
type NetworkMutatorCtx = NetworkMutatorInput['ctx'];

function createTx(location: NetworkMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {},
  };
}

function createCtx(): NetworkMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

function connection() {
  return {
    id: 'connection-1',
    group_a_id: 'group-a',
    group_b_id: 'group-b',
    connection_type: 'peer',
    parent_group_id: null,
    child_group_id: null,
    status: 'active',
  };
}

function connectionRequest() {
  return {
    id: 'request-1',
    active_connection_id: 'connection-1',
    proposed_connection_id: 'connection-1',
    group_a_id: 'group-a',
    group_b_id: 'group-b',
    desired_connection_type: 'peer',
    desired_parent_group_id: null,
    desired_child_group_id: null,
    initiator_group_id: 'group-a',
    status: 'pending',
    structure_status: 'pending',
  };
}

beforeEach(() => {
  canMock.mockReset();
  Object.values(helperMocks).forEach(mock => mock.mockReset());
  Object.values(groupHelperMocks).forEach(mock => mock.mockReset());
  Object.values(offlineGroupHelperMocks).forEach(mock => mock.mockReset());
  Object.values(graphMocks).forEach(mock => mock.mockReset());
  Object.values(conflictValidationMocks).forEach(mock => mock.mockReset());
  Object.values(serverNotifyMocks).forEach(mock => mock.mockReset());
  Object.values(serverHelperMocks).forEach(mock => mock.mockReset());
  Object.values(assemblyReconcileMocks).forEach(mock => mock.mockReset());
  groupHelperMocks.buildGroupsById.mockResolvedValue(new Map());
  groupHelperMocks.loadGroupWithDerivedNetworkMeta.mockResolvedValue(null);
  offlineGroupHelperMocks.reconcileOfflineHierarchyForBaseGroup.mockResolvedValue({
    affectedGroupIds: new Set(),
  });
  graphMocks.reconcileGroupGraph.mockResolvedValue({
    affectedGroupIds: new Set(),
    affectedUserIds: new Set(),
    affectedMembershipPairs: new Set(),
  });
  conflictValidationMocks.assertNoBlockingGroupConflicts.mockResolvedValue(undefined);
  serverHelperMocks.groupName.mockImplementation(async (_tx: unknown, groupId: string) =>
    groupId === 'group-a' ? 'Group A' : 'Group B'
  );
});

describe('networkServerMutators authorization', () => {
  it('reconciles general assembly invitations after creating a group connection', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValueOnce([]);
    groupHelperMocks.buildGroupsById.mockResolvedValue(
      new Map([
        ['group-a', { id: 'group-a', group_type: 'base' }],
        ['group-b', { id: 'group-b', group_type: 'sibling' }],
      ])
    );
    groupHelperMocks.recomputeSiblingGroupMemberships.mockResolvedValue(undefined);

    await networkServerMutators.createGroupConnection.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'connection-1',
        group_a_id: 'group-a',
        group_b_id: 'group-b',
        connection_type: 'peer',
        parent_group_id: null,
        child_group_id: null,
        status: 'active',
        grants: [],
        membership_rule: null,
      },
    });

    expect(
      assemblyReconcileMocks.reconcileGeneralAssemblyParticipantsForGroups
    ).toHaveBeenCalledWith(tx, ['group-a', 'group-b'], 'user-1');
  });

  it('allows deleting a connection with manage rights in the acting group only', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValue(connection());
    canMock.mockImplementation(async (_tx: unknown, _ctx: unknown, permission: unknown) => {
      if ((permission as { groupId?: string }).groupId === 'group-b') {
        throw new PermissionError('manage', 'groupRelationships', 'group:group-b');
      }
    });

    await networkServerMutators.deleteGroupConnection.fn({
      tx: tx as never,
      ctx,
      args: { id: 'connection-1', acting_group_id: 'group-a' },
    });

    expect(canMock).toHaveBeenCalledTimes(1);
    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-a',
    });
    expect(helperMocks.deleteGroupConnectionAndRequests).toHaveBeenCalledWith(tx, 'connection-1');
  });

  it('checks acting group relationship rights before deleting a connection', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-a');

    tx.run.mockResolvedValue(connection());
    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.deleteGroupConnection.fn({
        tx: tx as never,
        ctx,
        args: { id: 'connection-1', acting_group_id: 'group-a' },
      })
    ).rejects.toBe(error);

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-a',
    });
    expect(helperMocks.deleteGroupConnectionAndRequests).not.toHaveBeenCalled();
  });

  it('rejects deleting a connection when the acting group is not part of it', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValue(connection());

    await expect(
      networkServerMutators.deleteGroupConnection.fn({
        tx: tx as never,
        ctx,
        args: { id: 'connection-1', acting_group_id: 'group-c' },
      })
    ).rejects.toThrow('Acting group is not part of this connection');

    expect(canMock).not.toHaveBeenCalled();
    expect(helperMocks.deleteGroupConnectionAndRequests).not.toHaveBeenCalled();
  });

  it('checks initiator group rights before proposing a connection change', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-a');

    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.proposeGroupConnectionChange.fn({
        tx: tx as never,
        ctx,
        args: {
          id: 'request-1',
          active_connection_id: 'connection-1',
          proposed_connection_id: 'connection-1',
          group_a_id: 'group-a',
          group_b_id: 'group-b',
          desired_connection_type: 'peer',
          desired_parent_group_id: null,
          desired_child_group_id: null,
          initiator_group_id: 'group-a',
          grants: [],
          membership_rule: null,
        },
      })
    ).rejects.toBe(error);

    expect(helperMocks.proposeGroupConnectionChange).not.toHaveBeenCalled();
  });

  it('fires one inbound and one outgoing notification for a multi-right connection proposal', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const proposal = {
      id: 'request-1',
      active_connection_id: 'connection-1',
      proposed_connection_id: 'connection-1',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      desired_connection_type: 'peer' as const,
      desired_parent_group_id: null,
      desired_child_group_id: null,
      initiator_group_id: 'group-a',
      grants: [
        {
          id: 'grant-request-1',
          operation: 'upsert' as const,
          right_key: 'informationRight' as const,
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
        },
        {
          id: 'grant-request-2',
          operation: 'upsert' as const,
          right_key: 'activeVotingRight' as const,
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
        },
      ],
      membership_rule: null,
    };

    tx.run.mockResolvedValueOnce([]);

    await networkServerMutators.proposeGroupConnectionChange.fn({
      tx: tx as never,
      ctx,
      args: proposal,
    });

    expect(helperMocks.proposeGroupConnectionChange).toHaveBeenCalledWith(tx, proposal);
    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledTimes(2);
    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledWith('notifyRelationshipRequested', {
      senderId: 'user-1',
      sourceGroupId: 'group-a',
      sourceGroupName: 'Group A',
      targetGroupId: 'group-b',
      targetGroupName: 'Group B',
      relationshipType: 'peer',
      recipientGroupId: 'group-b',
    });
    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledWith('notifyRelationshipRequested', {
      senderId: 'user-1',
      sourceGroupId: 'group-a',
      sourceGroupName: 'Group A',
      targetGroupId: 'group-b',
      targetGroupName: 'Group B',
      relationshipType: 'peer',
      recipientGroupId: 'group-a',
    });
  });

  it('allows approving a connection request with counterparty relationship rights', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    groupHelperMocks.buildGroupsById.mockResolvedValue(
      new Map([
        ['group-a', { id: 'group-a', group_type: 'base' }],
        ['group-b', { id: 'group-b', group_type: 'sibling' }],
      ])
    );
    groupHelperMocks.recomputeSiblingGroupMemberships.mockResolvedValue(undefined);
    tx.run
      .mockResolvedValueOnce(connectionRequest())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await networkServerMutators.approveGroupConnectionRequest.fn({
      tx: tx as never,
      ctx,
      args: { id: 'request-1', grant_request_ids: [], approve_membership: false },
    });

    expect(canMock).toHaveBeenCalledTimes(1);
    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-b',
    });
    expect(conflictValidationMocks.assertNoBlockingGroupConflicts).toHaveBeenCalledWith(
      tx,
      ctx,
      expect.objectContaining({
        kind: 'group_connection_upsert',
        group_a_id: 'group-a',
        group_b_id: 'group-b',
      })
    );
    expect(helperMocks.approveGroupConnectionRequest).toHaveBeenCalledWith(
      tx,
      'request-1',
      [],
      false
    );
    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledWith('notifyRelationshipApproved', {
      senderId: 'user-1',
      sourceGroupId: 'group-a',
      sourceGroupName: 'Group A',
      targetGroupId: 'group-b',
      targetGroupName: 'Group B',
    });
    expect(
      assemblyReconcileMocks.reconcileGeneralAssemblyParticipantsForGroups
    ).toHaveBeenCalledWith(tx, ['group-a', 'group-b'], 'user-1');
  });

  it('reconciles offline hierarchy memberships after approving a hierarchy connection', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const request = {
      ...connectionRequest(),
      desired_connection_type: 'hierarchy',
      desired_parent_group_id: 'H1',
      desired_child_group_id: 'B2',
      group_a_id: 'B2',
      group_b_id: 'H1',
      initiator_group_id: 'H1',
    };

    groupHelperMocks.buildGroupsById.mockResolvedValue(
      new Map([
        ['B2', { id: 'B2', group_type: 'base' }],
        ['H1', { id: 'H1', group_type: 'hierarchical' }],
      ])
    );
    offlineGroupHelperMocks.reconcileOfflineHierarchyForBaseGroup.mockImplementation(
      async (_tx: unknown, groupId: string) => ({
        affectedGroupIds: groupId === 'B2' ? new Set(['H1']) : new Set(),
      })
    );
    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await networkServerMutators.approveGroupConnectionRequest.fn({
      tx: tx as never,
      ctx,
      args: { id: 'request-1', grant_request_ids: [], approve_membership: false },
    });

    expect(offlineGroupHelperMocks.reconcileOfflineHierarchyForBaseGroup).toHaveBeenCalledWith(
      tx,
      'B2'
    );
    expect(offlineGroupHelperMocks.reconcileOfflineHierarchyForBaseGroup).toHaveBeenCalledWith(
      tx,
      'H1'
    );
    expect(serverHelperMocks.recomputeGroupCounters).toHaveBeenCalledWith(tx, 'H1');
  });

  it('fires one approval notification for multiple accepted right requests', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const grantRequests = [
      {
        id: 'grant-request-1',
        existing_grant_id: null,
        operation: 'upsert',
        right_key: 'informationRight',
        holder_group_id: 'group-a',
        scope_group_id: 'group-b',
        status: 'pending',
        initiator_group_id: 'group-a',
      },
      {
        id: 'grant-request-2',
        existing_grant_id: null,
        operation: 'upsert',
        right_key: 'activeVotingRight',
        holder_group_id: 'group-a',
        scope_group_id: 'group-b',
        status: 'pending',
        initiator_group_id: 'group-a',
      },
    ];

    tx.run
      .mockResolvedValueOnce({ ...connectionRequest(), structure_status: 'approved' })
      .mockResolvedValueOnce(grantRequests)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await networkServerMutators.approveGroupConnectionRequest.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'request-1',
        grant_request_ids: ['grant-request-1', 'grant-request-2'],
        approve_membership: false,
      },
    });

    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledTimes(1);
    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledWith('notifyRelationshipApproved', {
      senderId: 'user-1',
      sourceGroupId: 'group-a',
      sourceGroupName: 'Group A',
      targetGroupId: 'group-b',
      targetGroupName: 'Group B',
    });
  });

  it('allows rejecting a connection request with counterparty relationship rights', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValueOnce(connectionRequest());
    helperMocks.rejectGroupConnectionRequest.mockResolvedValueOnce(connectionRequest());

    await networkServerMutators.rejectGroupConnectionRequest.fn({
      tx: tx as never,
      ctx,
      args: { id: 'request-1', grant_request_ids: [], reject_membership: false },
    });

    expect(canMock).toHaveBeenCalledTimes(1);
    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-b',
    });
    expect(helperMocks.rejectGroupConnectionRequest).toHaveBeenCalledWith(
      tx,
      'request-1',
      [],
      false,
      undefined
    );
  });

  it('denies approving when only initiator-side relationship rights are available', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-b');

    tx.run.mockResolvedValueOnce(connectionRequest());
    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.approveGroupConnectionRequest.fn({
        tx: tx as never,
        ctx,
        args: { id: 'request-1', grant_request_ids: [], approve_membership: false },
      })
    ).rejects.toBe(error);

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-b',
    });
    expect(helperMocks.approveGroupConnectionRequest).not.toHaveBeenCalled();
  });

  it('denies rejecting when counterparty relationship rights are missing', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-b');

    tx.run.mockResolvedValueOnce(connectionRequest());
    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.rejectGroupConnectionRequest.fn({
        tx: tx as never,
        ctx,
        args: { id: 'request-1', grant_request_ids: [], reject_membership: false },
      })
    ).rejects.toBe(error);

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-b',
    });
    expect(helperMocks.rejectGroupConnectionRequest).not.toHaveBeenCalled();
  });

  it('blocks approving when server hierarchy conflict validation fails', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const conflictError = new Error('__GROUP_CONFLICT__:{"blocking":true,"conflicts":[]}');
    const request = {
      ...connectionRequest(),
      desired_connection_type: 'hierarchy',
      desired_parent_group_id: 'group-b',
      desired_child_group_id: 'group-a',
    };
    const grantRequest = {
      id: 'grant-request-1',
      existing_grant_id: null,
      operation: 'upsert',
      right_key: 'activeVotingRight',
      holder_group_id: 'group-a',
      scope_group_id: 'group-b',
      status: 'pending',
      initiator_group_id: 'group-a',
    };

    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce([grantRequest])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    conflictValidationMocks.assertNoBlockingGroupConflicts.mockRejectedValueOnce(conflictError);

    await expect(
      networkServerMutators.approveGroupConnectionRequest.fn({
        tx: tx as never,
        ctx,
        args: {
          id: 'request-1',
          grant_request_ids: ['grant-request-1'],
          approve_membership: false,
        },
      })
    ).rejects.toBe(conflictError);

    expect(conflictValidationMocks.assertNoBlockingGroupConflicts).toHaveBeenCalledWith(
      tx,
      ctx,
      expect.objectContaining({
        kind: 'group_connection_upsert',
        connection_type: 'hierarchy',
        parent_group_id: 'group-b',
        child_group_id: 'group-a',
        grants: [
          expect.objectContaining({
            id: 'grant-request-1',
            right_key: 'activeVotingRight',
            holder_group_id: 'group-a',
            scope_group_id: 'group-b',
          }),
        ],
      })
    );
    expect(helperMocks.approveGroupConnectionRequest).not.toHaveBeenCalled();
    expect(
      assemblyReconcileMocks.reconcileGeneralAssemblyParticipantsForGroups
    ).not.toHaveBeenCalled();
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalled();
  });
});
