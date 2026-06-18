import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const helperMocks = vi.hoisted(() => ({
  approveGroupConnectionRequest: vi.fn(),
  deleteGroupConnectionAndRequests: vi.fn(),
  proposeGroupConnectionChange: vi.fn(),
  rejectGroupConnectionRequest: vi.fn(),
  syncGroupConnectionChildren: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('../mutator-helpers', () => helperMocks);

import { networkSharedMutators } from '../shared-mutators';

type SharedMutatorInput = Parameters<typeof networkSharedMutators.deleteGroupConnection.fn>[0];
type SharedMutatorTx = SharedMutatorInput['tx'];
type SharedMutatorCtx = SharedMutatorInput['ctx'];

function createTx(location: SharedMutatorTx['location']) {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {},
  };
}

function createCtx(): SharedMutatorCtx {
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

beforeEach(() => {
  canMock.mockReset();
  Object.values(helperMocks).forEach(mock => mock.mockReset());
});

describe('networkSharedMutators authorization', () => {
  it('checks only the acting group when deleting on the server', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValue(connection());
    canMock.mockImplementation(async (_tx: unknown, _ctx: unknown, permission: unknown) => {
      if ((permission as { groupId?: string }).groupId === 'group-b') {
        throw new PermissionError('manage', 'groupRelationships', 'group:group-b');
      }
    });

    await networkSharedMutators.deleteGroupConnection.fn({
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

  it('rejects server delete when the acting group is outside the connection', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run.mockResolvedValue(connection());

    await expect(
      networkSharedMutators.deleteGroupConnection.fn({
        tx: tx as never,
        ctx,
        args: { id: 'connection-1', acting_group_id: 'group-c' },
      })
    ).rejects.toThrow('Acting group is not part of this connection');

    expect(canMock).not.toHaveBeenCalled();
    expect(helperMocks.deleteGroupConnectionAndRequests).not.toHaveBeenCalled();
  });

  it('keeps client deletes optimistic without local permission checks', async () => {
    const tx = createTx('client');
    const ctx = createCtx();

    await networkSharedMutators.deleteGroupConnection.fn({
      tx: tx as never,
      ctx,
      args: { id: 'connection-1', acting_group_id: 'group-a' },
    });

    expect(tx.run).not.toHaveBeenCalled();
    expect(canMock).not.toHaveBeenCalled();
    expect(helperMocks.deleteGroupConnectionAndRequests).toHaveBeenCalledWith(tx, 'connection-1');
  });
});
