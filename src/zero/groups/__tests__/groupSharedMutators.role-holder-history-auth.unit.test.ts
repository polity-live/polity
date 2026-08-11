import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { groupSharedMutators } from '../shared-mutators';

type GroupMutatorInput = Parameters<typeof groupSharedMutators.createRoleHolderHistory.fn>[0];
type GroupMutatorTx = GroupMutatorInput['tx'];
type GroupMutatorCtx = GroupMutatorInput['ctx'];

function createTx(location: GroupMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      role_holder_history: {
        insert: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}

function createCtx(): GroupMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

const createHistoryArgs = {
  id: 'history-1',
  role_id: 'role-1',
  user_id: 'user-2',
  start_date: 1,
  end_date: 0,
  reason: null,
};

describe('groupSharedMutators role holder history authorization', () => {
  beforeEach(() => {
    canMock.mockReset();
  });

  it('rejects role holder history creation without role management rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupAccessRoles', 'group:group-1');
    tx.run.mockResolvedValue({ id: 'role-1', group_id: 'group-1', event_id: null, blog_id: null });
    canMock.mockRejectedValue(error);

    await expect(
      groupSharedMutators.createRoleHolderHistory.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: createHistoryArgs,
      })
    ).rejects.toBe(error);

    expect(tx.mutate.role_holder_history.insert).not.toHaveBeenCalled();
  });

  it('rejects role holder history updates without role management rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupAccessRoles', 'group:group-1');
    tx.run.mockResolvedValueOnce({ id: 'history-1', role_id: 'role-1' }).mockResolvedValueOnce({
      id: 'role-1',
      group_id: 'group-1',
      event_id: null,
      blog_id: null,
    });
    canMock.mockRejectedValue(error);

    await expect(
      groupSharedMutators.updateRoleHolderHistory.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'history-1', end_date: 2 },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.role_holder_history.update).not.toHaveBeenCalled();
  });

  it('keeps role holder history creation optimistic on the client', async () => {
    const tx = createTx('client');

    await expect(
      groupSharedMutators.createRoleHolderHistory.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: createHistoryArgs,
      })
    ).resolves.toBeUndefined();

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.role_holder_history.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'history-1',
        role_id: 'role-1',
      })
    );
  });
});
