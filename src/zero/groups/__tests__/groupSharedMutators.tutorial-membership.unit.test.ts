import { describe, expect, it, vi } from 'vitest';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { groupSharedMutators } from '../shared-mutators';

function createTx() {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'server' as const,
    run: vi.fn(),
    mutate: {
      group_membership: {
        delete: vi.fn(),
      },
    },
  };
}

const ctx = {
  userID: 'user-1',
  email: 'user-1@example.com',
};

describe('groupSharedMutators tutorial membership protection', () => {
  it('keeps a pending tutorial membership request when clicked again', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'membership-1',
        group_id: 'group-1',
        user_id: 'user-1',
        status: 'requested',
        source: 'direct',
      })
      .mockResolvedValueOnce({
        id: 'group-1',
        tutorial_run_id: 'tutorial-run-1',
      });

    await groupSharedMutators.leaveGroup.fn({
      tx: tx as never,
      ctx,
      args: { id: 'membership-1' },
    });

    expect(tx.mutate.group_membership.delete).not.toHaveBeenCalled();
  });

  it('still allows a pending request outside the tutorial to be withdrawn', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'membership-1',
        group_id: 'group-1',
        user_id: 'user-1',
        status: 'requested',
        source: 'direct',
      })
      .mockResolvedValueOnce({
        id: 'group-1',
        tutorial_run_id: null,
      });

    await groupSharedMutators.leaveGroup.fn({
      tx: tx as never,
      ctx,
      args: { id: 'membership-1' },
    });

    expect(tx.mutate.group_membership.delete).toHaveBeenCalledWith({
      id: 'membership-1',
    });
  });
});
