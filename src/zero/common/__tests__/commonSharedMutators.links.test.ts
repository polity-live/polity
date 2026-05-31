import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { commonSharedMutators } from '../shared-mutators';

type CommonMutatorInput = Parameters<typeof commonSharedMutators.createLink.fn>[0];
type CommonMutatorTx = CommonMutatorInput['tx'];
type CommonMutatorCtx = CommonMutatorInput['ctx'];

function createTx(location: CommonMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      link: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): CommonMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('commonSharedMutators link authorization', () => {
  it('rejects group link creation without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupLinks', 'group:group-1');
    canMock.mockRejectedValueOnce(error);

    await expect(
      commonSharedMutators.createLink.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'link-1',
          label: 'Website',
          url: 'https://example.com',
          user_id: 'user-1',
          group_id: 'group-1',
          event_id: null,
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.link.insert).not.toHaveBeenCalled();
  });

  it('checks manage rights before deleting a group link', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupLinks', 'group:group-1');

    tx.run.mockResolvedValue({
      id: 'link-1',
      group_id: 'group-1',
    });
    canMock.mockRejectedValueOnce(error);

    await expect(
      commonSharedMutators.deleteLink.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'link-1' },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.link.delete).not.toHaveBeenCalled();
  });
});
