import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const helperMocks = vi.hoisted(() => ({
  approveGroupConnectionRequest: vi.fn(),
  deleteGroupConnectionAndRequests: vi.fn(),
  proposeGroupConnectionChange: vi.fn(),
  rejectGroupConnectionRequest: vi.fn(),
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

vi.mock('../../groups/membership-helpers', () => ({
  buildGroupsById: vi.fn(),
  loadGroupWithDerivedNetworkMeta: vi.fn(),
  reconcileHierarchyForBaseGroup: vi.fn(),
  recomputeSiblingGroupMemberships: vi.fn(),
}));

vi.mock('../../events/delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForGroups: vi.fn(),
}));

vi.mock('../../events/assembly-reconcile', () => ({
  reconcileGeneralAssemblyParticipantsForGroups: vi.fn(),
}));

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
});

describe('networkServerMutators authorization', () => {
  it('checks group relationship rights before deleting a connection', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-a');

    tx.run.mockResolvedValue(connection());
    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.deleteGroupConnection.fn({
        tx: tx as never,
        ctx,
        args: { id: 'connection-1' },
      })
    ).rejects.toBe(error);

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-a',
    });
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

  it('checks connection rights before approving a connection request', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-a');

    tx.run.mockResolvedValueOnce(connectionRequest());
    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.approveGroupConnectionRequest.fn({
        tx: tx as never,
        ctx,
        args: { id: 'request-1', grant_request_ids: [], approve_membership: false },
      })
    ).rejects.toBe(error);

    expect(helperMocks.approveGroupConnectionRequest).not.toHaveBeenCalled();
  });

  it('checks connection rights before rejecting a connection request', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'groupRelationships', 'group:group-a');

    tx.run.mockResolvedValueOnce(connectionRequest());
    canMock.mockRejectedValueOnce(error);

    await expect(
      networkServerMutators.rejectGroupConnectionRequest.fn({
        tx: tx as never,
        ctx,
        args: { id: 'request-1', grant_request_ids: [], reject_membership: false },
      })
    ).rejects.toBe(error);

    expect(helperMocks.rejectGroupConnectionRequest).not.toHaveBeenCalled();
  });
});
