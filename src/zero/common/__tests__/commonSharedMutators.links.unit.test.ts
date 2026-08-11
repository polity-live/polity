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
      subscriber: {
        insert: vi.fn(),
      },
    },
  };
}

function createCtx(userID = 'user-1'): CommonMutatorCtx {
  return {
    userID,
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

describe('commonSharedMutators subscription authorization', () => {
  const subscriptionTargets = [
    { field: 'user_id', id: 'target-user' },
    { field: 'group_id', id: 'group-1' },
    { field: 'event_id', id: 'event-1' },
    { field: 'amendment_id', id: 'amendment-1' },
    { field: 'blog_id', id: 'blog-1' },
  ] as const;

  it.each(subscriptionTargets)(
    'allows a signed-in user to subscribe through visibility access to $field without role rights',
    async ({ field, id }) => {
      const tx = createTx('server');
      tx.run.mockResolvedValueOnce({ id, visibility: 'authenticated' });
      const args = {
        id: 'subscription-1',
        user_id: null,
        group_id: null,
        amendment_id: null,
        event_id: null,
        blog_id: null,
        [field]: id,
      };

      await expect(
        commonSharedMutators.subscribe.fn({
          tx: tx as never,
          ctx: createCtx(),
          args,
        })
      ).resolves.toBeUndefined();

      expect(canMock).not.toHaveBeenCalled();
      expect(tx.mutate.subscriber.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'subscription-1',
          [field]: id,
          subscriber_id: 'user-1',
        })
      );
    }
  );

  it('allows a private target returned by the shared visibility filter', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({
      id: 'amendment-1',
      title: 'Private but visible amendment',
      visibility: 'private',
    });

    await expect(
      commonSharedMutators.subscribe.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'subscription-1',
          user_id: null,
          group_id: null,
          amendment_id: 'amendment-1',
          event_id: null,
          blog_id: null,
        },
      })
    ).resolves.toBeUndefined();

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.subscriber.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'subscription-1',
        amendment_id: 'amendment-1',
        subscriber_id: 'user-1',
      })
    );
  });

  it('rejects a target hidden by the shared visibility filter', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce(null);

    await expect(
      commonSharedMutators.subscribe.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'subscription-1',
          user_id: null,
          group_id: null,
          amendment_id: 'amendment-1',
          event_id: null,
          blog_id: null,
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.subscriber.insert).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated subscriptions before reading the target', async () => {
    const tx = createTx('server');

    await expect(
      commonSharedMutators.subscribe.fn({
        tx: tx as never,
        ctx: createCtx('anon'),
        args: {
          id: 'subscription-1',
          user_id: null,
          group_id: 'group-1',
          amendment_id: null,
          event_id: null,
          blog_id: null,
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.subscriber.insert).not.toHaveBeenCalled();
  });
});
