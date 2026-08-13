import { beforeEach, describe, expect, it, vi } from 'vitest';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { groupSharedMutators } from '../shared-mutators';

type GroupMutatorInput = Parameters<typeof groupSharedMutators.assignActionRight.fn>[0];
type GroupMutatorTx = GroupMutatorInput['tx'];
type GroupMutatorCtx = GroupMutatorInput['ctx'];

function createTx() {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'server' as GroupMutatorTx['location'],
    run: vi.fn(),
    mutate: {
      action_right: {
        insert: vi.fn(),
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

describe('groupSharedMutators amendment action rights', () => {
  beforeEach(() => {
    canMock.mockReset();
  });

  it('rejects non-amendment action rights for amendment-scoped roles', async () => {
    const tx = createTx();

    await expect(
      groupSharedMutators.assignActionRight.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'right-1',
          role_id: 'role-1',
          resource: 'events',
          action: 'manage',
          amendment_id: 'amendment-1',
          group_id: null,
          event_id: null,
          blog_id: null,
        },
      })
    ).rejects.toThrow('is not valid for amendment roles');

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.action_right.insert).not.toHaveBeenCalled();
  });

  it('allows valid amendment action rights for matching amendment roles', async () => {
    const tx = createTx();
    tx.run.mockResolvedValue({
      id: 'role-1',
      amendment_id: 'amendment-1',
      event_id: null,
      assignee_kind: 'member',
    });
    canMock.mockResolvedValue(undefined);

    await groupSharedMutators.assignActionRight.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'right-1',
        role_id: 'role-1',
        resource: 'amendments',
        action: 'view',
        amendment_id: 'amendment-1',
        group_id: null,
        event_id: null,
        blog_id: null,
      },
    });

    expect(canMock).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({
        action: 'manage',
        resource: 'amendments',
        amendmentId: 'amendment-1',
      })
    );
    expect(tx.mutate.action_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'right-1',
        resource: 'amendments',
        action: 'view',
        amendment_id: 'amendment-1',
      })
    );
  });

  it('rejects action rights whose amendment scope does not match the role', async () => {
    const tx = createTx();
    tx.run.mockResolvedValue({
      id: 'role-1',
      amendment_id: 'other-amendment',
      event_id: null,
      assignee_kind: 'member',
    });
    canMock.mockResolvedValue(undefined);

    await expect(
      groupSharedMutators.assignActionRight.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'right-1',
          role_id: 'role-1',
          resource: 'amendments',
          action: 'view',
          amendment_id: 'amendment-1',
          group_id: null,
          event_id: null,
          blog_id: null,
        },
      })
    ).rejects.toThrow('scope does not match amendment role scope');

    expect(tx.mutate.action_right.insert).not.toHaveBeenCalled();
  });
});
