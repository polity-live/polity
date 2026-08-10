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
    mutate: {
      role: {
        insert: vi.fn(),
        update: vi.fn(),
      },
    },
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

    tx.run.mockResolvedValueOnce([{ id: 'group-a' }, { id: 'group-b' }]);
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

    tx.run.mockResolvedValueOnce([{ id: 'group-a' }, { id: 'group-b' }]).mockResolvedValueOnce([]);

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

  it('ignores a delayed proposal after a tutorial endpoint was cleaned up', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValueOnce([{ id: 'group-a' }]);

    await networkServerMutators.proposeGroupConnectionChange.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'stale-request',
        active_connection_id: null,
        proposed_connection_id: 'stale-connection',
        group_a_id: 'group-a',
        group_b_id: 'deleted-group',
        desired_connection_type: 'hierarchy',
        desired_parent_group_id: 'deleted-group',
        desired_child_group_id: 'group-a',
        initiator_group_id: 'group-a',
        grants: [],
        membership_rule: null,
      },
    });

    expect(canMock).not.toHaveBeenCalled();
    expect(helperMocks.proposeGroupConnectionChange).not.toHaveBeenCalled();
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalled();
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

  it('allows the owner to simulate counterparty approval within one tutorial run', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const permissionError = new PermissionError('manage', 'groupRelationships', 'group:group-b');

    canMock.mockRejectedValueOnce(permissionError);
    tx.run
      .mockResolvedValueOnce(connectionRequest())
      .mockResolvedValueOnce([
        { id: 'group-a', tutorial_run_id: 'tutorial-run-1' },
        { id: 'group-b', tutorial_run_id: 'tutorial-run-1' },
      ])
      .mockResolvedValueOnce({
        id: 'tutorial-run-1',
        user_id: 'user-1',
        status: 'active',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await networkServerMutators.approveGroupConnectionRequest.fn({
      tx: tx as never,
      ctx,
      args: { id: 'request-1', grant_request_ids: [], approve_membership: false },
    });

    expect(helperMocks.approveGroupConnectionRequest).toHaveBeenCalledWith(
      tx,
      'request-1',
      [],
      false
    );
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

  it('reconciles every role-default strategy and all affected counters', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const roleSets = new Map<string, any[]>([
      [
        'guest-default',
        [
          {
            id: 'guest-selected',
            name: 'Visitor',
            assignee_kind: 'guest',
            default_request_role: true,
            default_invite_role: true,
          },
          {
            id: 'guest-old',
            name: 'Old visitor',
            assignee_kind: 'guest',
            default_request_role: true,
            default_invite_role: true,
          },
        ],
      ],
      [
        'guest-name',
        [
          {
            id: 'named-guest',
            name: 'Guest',
            assignee_kind: 'guest',
            default_request_role: false,
            default_invite_role: true,
          },
        ],
      ],
      [
        'guest-first',
        [
          {
            id: 'first-guest',
            name: 'Visitor',
            assignee_kind: 'guest',
            default_request_role: false,
            default_invite_role: false,
          },
        ],
      ],
      ['guest-created', []],
      [
        'member-default',
        [
          {
            id: 'member-selected',
            name: 'Participant',
            assignee_kind: 'member',
            default_request_role: true,
            default_invite_role: true,
          },
          {
            id: 'guest-to-clear',
            name: 'Guest',
            assignee_kind: 'guest',
            default_request_role: false,
            default_invite_role: true,
          },
        ],
      ],
      [
        'member-name',
        [
          {
            id: 'named-member',
            name: 'Member',
            assignee_kind: 'member',
            default_request_role: false,
            default_invite_role: true,
          },
          {
            id: 'inactive-guest',
            name: 'Guest',
            assignee_kind: 'guest',
            default_request_role: false,
            default_invite_role: false,
          },
        ],
      ],
      [
        'member-first',
        [
          {
            id: 'first-member',
            name: 'Participant',
            assignee_kind: 'member',
            default_request_role: false,
            default_invite_role: false,
          },
        ],
      ],
      ['member-none', []],
      ['member-null-mode', []],
      ['member-unknown-mode', []],
    ]);
    const groups = [...roleSets.keys()].map(id => ({ id }));

    groupHelperMocks.buildGroupsById.mockResolvedValue(
      new Map(groups.map(group => [group.id, group]))
    );
    groupHelperMocks.loadGroupWithDerivedNetworkMeta.mockImplementation(
      async (_tx: unknown, groupId: string) => {
        if (groupId.startsWith('guest-')) {
          return {
            id: groupId,
            group_type: 'sibling',
            primary_sibling_membership_mode: 'all_members',
          };
        }
        if (groupId === 'member-null-mode') {
          return {
            id: groupId,
            group_type: 'sibling',
            primary_sibling_membership_mode: null,
          };
        }
        if (groupId === 'member-unknown-mode') {
          return {
            id: groupId,
            group_type: 'sibling',
            primary_sibling_membership_mode: 'unknown',
          };
        }
        return { id: groupId, group_type: 'base', primary_sibling_membership_mode: null };
      }
    );
    tx.run.mockResolvedValueOnce([]);
    for (const roles of roleSets.values()) {
      tx.run.mockResolvedValueOnce(roles);
    }
    graphMocks.reconcileGroupGraph
      .mockResolvedValueOnce({
        affectedGroupIds: new Set(['graph-group']),
        affectedUserIds: new Set(['first-user']),
        affectedMembershipPairs: new Set(['pair-group:pair-user', ':missing-group']),
      })
      .mockResolvedValueOnce({
        affectedGroupIds: new Set(['final-group']),
        affectedUserIds: new Set(['final-user']),
        affectedMembershipPairs: new Set(['missing-user:']),
      });
    offlineGroupHelperMocks.reconcileOfflineHierarchyForBaseGroup.mockResolvedValue({
      affectedGroupIds: new Set(['offline-group']),
    });

    await networkServerMutators.createGroupConnection.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'connection-role-defaults',
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

    expect(tx.mutate.role.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.role.update).toHaveBeenCalled();
    expect(serverHelperMocks.recomputeGroupCounters).toHaveBeenCalledWith(tx, 'offline-group');
    expect(serverHelperMocks.recomputeUserCounters).toHaveBeenCalledWith(tx, 'final-user');
    expect(serverHelperMocks.syncUserWithGroupConversation).toHaveBeenCalledTimes(1);
  });

  it('covers missing, unsupported, fallback, and explicit connection updates', async () => {
    const ctx = createCtx();
    const missingTx = createTx('server');
    missingTx.run.mockResolvedValueOnce(null);
    await expect(
      networkServerMutators.updateGroupConnection.fn({
        tx: missingTx as never,
        ctx,
        args: { id: 'missing' } as never,
      })
    ).rejects.toThrow('Group connection not found');

    const unsupportedTx = createTx('server');
    unsupportedTx.run.mockResolvedValueOnce({ ...connection(), connection_type: 'legacy' });
    await expect(
      networkServerMutators.updateGroupConnection.fn({
        tx: unsupportedTx as never,
        ctx,
        args: { id: 'connection-1', grants: [], membership_rule: null } as never,
      })
    ).rejects.toThrow('Unsupported group connection type');

    const fallbackTx = createTx('server');
    fallbackTx.run
      .mockResolvedValueOnce(connection())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);
    await networkServerMutators.updateGroupConnection.fn({
      tx: fallbackTx as never,
      ctx,
      args: { id: 'connection-1' } as never,
    });

    const explicitTx = createTx('server');
    explicitTx.run.mockResolvedValueOnce(connection()).mockResolvedValueOnce([]);
    await networkServerMutators.updateGroupConnection.fn({
      tx: explicitTx as never,
      ctx,
      args: {
        id: 'connection-1',
        group_a_id: 'group-a',
        group_b_id: 'group-b',
        connection_type: 'hierarchy',
        parent_group_id: 'group-a',
        child_group_id: 'group-b',
        grants: [],
        membership_rule: null,
      },
    });
  });

  it('validates source-role ownership for membership rules', async () => {
    const ctx = createCtx();
    const args = {
      id: 'connection-with-role',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      connection_type: 'peer' as const,
      parent_group_id: null,
      child_group_id: null,
      status: 'active' as const,
      grants: [],
      membership_rule: {
        member_source_group_id: 'group-a',
        member_target_group_id: 'group-b',
        membership_mode: 'role_members' as const,
        required_source_role_id: 'role-1',
        eligible_origin_group_ids: [],
      },
    };

    for (const role of [null, { id: 'role-1', group_id: 'group-b' }]) {
      const invalidTx = createTx('server');
      invalidTx.run.mockResolvedValueOnce(role);
      await expect(
        networkServerMutators.createGroupConnection.fn({
          tx: invalidTx as never,
          ctx,
          args,
        })
      ).rejects.toThrow('required membership role');
    }

    const validTx = createTx('server');
    validTx.run
      .mockResolvedValueOnce({ id: 'role-1', group_id: 'group-a' })
      .mockResolvedValueOnce([]);
    await networkServerMutators.createGroupConnection.fn({
      tx: validTx as never,
      ctx,
      args: args as never,
    });
  });

  it('covers deletion without a persisted connection', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce(null);

    await networkServerMutators.deleteGroupConnection.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { id: 'already-gone', acting_group_id: 'group-a' },
    });

    expect(helperMocks.deleteGroupConnectionAndRequests).toHaveBeenCalledWith(tx, 'already-gone');
    expect(groupHelperMocks.buildGroupsById).not.toHaveBeenCalled();
  });

  it('proposes a new connection with filtered grants and an upsert membership rule', async () => {
    const tx = createTx('server');
    const args = {
      id: 'request-new',
      active_connection_id: null,
      proposed_connection_id: 'connection-new',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      desired_connection_type: 'peer' as const,
      desired_parent_group_id: null,
      desired_child_group_id: null,
      initiator_group_id: 'group-b',
      grants: [
        {
          id: 'grant-upsert',
          operation: 'upsert' as const,
          right_key: 'informationRight' as const,
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
        },
        {
          id: 'grant-delete',
          operation: 'delete' as const,
          right_key: 'activeVotingRight' as const,
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
        },
      ],
      membership_rule: {
        id: 'membership-request',
        operation: 'upsert' as const,
        member_source_group_id: 'group-a',
        member_target_group_id: 'group-b',
        membership_mode: 'all_members' as const,
        required_source_role_id: null,
        eligible_origin_group_ids: [],
      },
    };
    tx.run
      .mockResolvedValueOnce([{ id: 'group-a' }, { id: 'group-b' }])
      .mockResolvedValueOnce([]);

    await networkServerMutators.proposeGroupConnectionChange.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: args as never,
    });

    expect(helperMocks.proposeGroupConnectionChange).toHaveBeenCalledWith(tx, args);
    expect(canMock).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ groupId: 'group-b' })
    );
  });

  it('ignores empty affected group sets and absent relationship group ids', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce([{ id: 'group-a' }, { id: 'group-b' }])
      .mockResolvedValueOnce([
        { ...connection(), id: 'connection-new' },
        { ...connection(), id: 'other-connection' },
      ]);
    const args = {
      id: 'request-no-initiator',
      active_connection_id: null,
      proposed_connection_id: 'connection-new',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      desired_connection_type: 'peer' as const,
      desired_parent_group_id: null,
      desired_child_group_id: null,
      initiator_group_id: null,
      grants: [],
      membership_rule: null,
    };

    await networkServerMutators.proposeGroupConnectionChange.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: args as never,
    });

    expect(canMock).not.toHaveBeenCalled();

    groupHelperMocks.buildGroupsById.mockClear();
    helperMocks.rejectGroupConnectionRequest.mockResolvedValueOnce({
      group_a_id: null,
      group_b_id: undefined,
    });
    const rejectTx = createTx('server');
    rejectTx.run.mockResolvedValueOnce(connectionRequest());
    await networkServerMutators.rejectGroupConnectionRequest.fn({
      tx: rejectTx as never,
      ctx: createCtx(),
      args: { id: 'request-1', grant_request_ids: [], reject_membership: false },
    });
    expect(groupHelperMocks.buildGroupsById).not.toHaveBeenCalled();
  });

  it('rejects missing approval and rejection requests', async () => {
    for (const name of ['approveGroupConnectionRequest', 'rejectGroupConnectionRequest'] as const) {
      const tx = createTx('server');
      tx.run.mockResolvedValueOnce(null);
      await expect(
        networkServerMutators[name].fn({
          tx: tx as never,
          ctx: createCtx(),
          args: { id: 'missing' } as never,
        })
      ).rejects.toThrow('Group connection request not found');
    }
  });

  it('rejects unsupported requested connection types', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ ...connectionRequest(), desired_connection_type: 'legacy' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      networkServerMutators.approveGroupConnectionRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'request-1' } as never,
      })
    ).rejects.toThrow('Unsupported requested group connection type');
  });

  it('covers membership request selection, sorting, approval, and notification suppression', async () => {
    const ctx = createCtx();
    const cases = [
      {
        mode: 'all_members',
        membership: {
          id: 'membership-all',
          operation: 'upsert',
          status: 'pending',
          member_source_group_id: 'group-a',
          member_target_group_id: 'group-b',
          membership_mode: 'all_members',
          required_source_role_id: null,
          updated_at: 30,
          created_at: 20,
        },
        origins: [],
        args: { grant_request_ids: ['not-selected'], approve_membership: true },
      },
      {
        mode: 'role_members',
        membership: {
          id: 'membership-role',
          operation: 'upsert',
          status: 'pending',
          member_source_group_id: 'group-a',
          member_target_group_id: 'group-b',
          membership_mode: 'role_members',
          required_source_role_id: 'role-1',
          updated_at: null,
          created_at: 40,
        },
        origins: [],
        args: { grant_request_ids: null, approve_membership: null },
      },
      {
        mode: 'selected_source_groups',
        membership: {
          id: 'membership-selected',
          operation: 'upsert',
          status: 'pending',
          member_source_group_id: 'group-a',
          member_target_group_id: 'group-b',
          membership_mode: 'selected_source_groups',
          required_source_role_id: null,
          updated_at: 50,
          created_at: null,
        },
        origins: [{ eligible_origin_group_id: 'origin-1' }],
        args: { approve_membership: false },
      },
      {
        mode: 'invalid',
        membership: {
          id: 'membership-invalid',
          operation: 'upsert',
          status: 'approved',
          member_source_group_id: '',
          member_target_group_id: '',
          membership_mode: 'invalid',
          required_source_role_id: null,
          updated_at: 50,
          created_at: 1,
        },
        origins: [],
        args: { grant_request_ids: [], approve_membership: false },
      },
    ];

    for (const testCase of cases) {
      const tx = createTx('server');
      const request = {
        ...connectionRequest(),
        active_connection_id: null,
        proposed_connection_id: `connection-${testCase.mode}`,
        structure_status: 'approved',
      };
      const grantRequests = [
        {
          id: 'grant-delete',
          operation: 'delete',
          status: 'pending',
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
        },
        {
          id: 'grant-approved',
          operation: 'upsert',
          status: 'approved',
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
        },
        {
          id: 'grant-unselected',
          operation: 'upsert',
          status: 'pending',
          right_key: 'informationRight',
          holder_group_id: 'group-a',
          scope_group_id: 'group-b',
          initiator_group_id: undefined,
        },
      ];
      const membershipRequests = [
        testCase.membership,
        {
          id: 'membership-zero',
          operation: 'delete',
          status: 'pending',
          member_source_group_id: null,
          member_target_group_id: null,
          membership_mode: null,
          updated_at: null,
          created_at: null,
        },
        {
          id: 'membership-created',
          operation: 'delete',
          status: 'pending',
          member_source_group_id: 'group-a',
          member_target_group_id: null,
          membership_mode: 'all_members',
          updated_at: null,
          created_at: 2,
        },
      ];
      tx.run
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(grantRequests)
        .mockResolvedValueOnce(membershipRequests)
        .mockResolvedValueOnce(testCase.origins);
      if (testCase.mode === 'role_members') {
        tx.run.mockResolvedValueOnce({ id: 'role-1', group_id: 'group-a' });
      }
      tx.run.mockResolvedValueOnce([]);

      await networkServerMutators.approveGroupConnectionRequest.fn({
        tx: tx as never,
        ctx,
        args: { id: 'request-1', ...testCase.args } as never,
      });
    }

    serverNotifyMocks.fireNotification.mockClear();
    const quietTx = createTx('server');
    quietTx.run
      .mockResolvedValueOnce({ ...connectionRequest(), structure_status: 'approved' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await networkServerMutators.approveGroupConnectionRequest.fn({
      tx: quietTx as never,
      ctx,
      args: { id: 'request-1', grant_request_ids: [], approve_membership: false },
    });
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalled();
  });

  it('covers tutorial authorization fallback shapes including paused runs', async () => {
    const ctx = createCtx();
    const permissionError = new PermissionError('manage', 'groupRelationships', 'group');
    const rejectedCases = [
      {
        request: {
          ...connectionRequest(),
          group_b_id: 'group-a',
          initiator_group_id: 'group-a',
        },
        reads: [null],
      },
      {
        request: connectionRequest(),
        reads: [[{ id: 'group-a', tutorial_run_id: 'run-1' }]],
      },
      {
        request: connectionRequest(),
        reads: [
          [
            { id: 'group-a', tutorial_run_id: 'run-1' },
            { id: 'group-b', tutorial_run_id: 'run-1' },
          ],
          { id: 'run-1', status: 'complete' },
        ],
      },
    ];
    for (const testCase of rejectedCases) {
      canMock.mockReset();
      canMock.mockRejectedValueOnce(permissionError);
      const tx = createTx('server');
      tx.run.mockResolvedValueOnce(testCase.request);
      for (const read of testCase.reads) tx.run.mockResolvedValueOnce(read);
      await expect(
        networkServerMutators.rejectGroupConnectionRequest.fn({
          tx: tx as never,
          ctx,
          args: { id: 'request-1' } as never,
        })
      ).rejects.toBe(permissionError);
    }

    canMock.mockReset();
    canMock.mockRejectedValueOnce(permissionError);
    const pausedTx = createTx('server');
    pausedTx.run
      .mockResolvedValueOnce(connectionRequest())
      .mockResolvedValueOnce([
        { id: 'group-a', tutorial_run_id: 'run-paused' },
        { id: 'group-b', tutorial_run_id: 'run-paused' },
      ])
      .mockResolvedValueOnce({ id: 'run-paused', status: 'paused' });
    helperMocks.rejectGroupConnectionRequest.mockResolvedValueOnce({
      group_a_id: null,
      group_b_id: null,
    });
    await networkServerMutators.rejectGroupConnectionRequest.fn({
      tx: pausedTx as never,
      ctx,
      args: { id: 'request-1' } as never,
    });
  });
});
