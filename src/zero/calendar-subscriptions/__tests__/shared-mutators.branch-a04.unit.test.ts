import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({ defineMutator: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../schema', () => ({
  calendarSubscriptionCreateSchema: {},
  calendarSubscriptionUpdateSchema: {},
  calendarSubscriptionDeleteSchema: {},
}));
vi.mock('../../rbac/authorize', () => ({
  requireAuthenticated: (...args: unknown[]) => auth.requireAuthenticated(...args),
  requireOwner: (...args: unknown[]) => auth.requireOwner(...args),
}));
vi.mock('../../schema', () => {
  const chain: Record<string, unknown> = {};
  const proxy = new Proxy(chain, {
    get: (_target, key) => (key === 'where' || key === 'one' ? () => proxy : proxy),
  });
  return { zql: { calendar_subscription: proxy } };
});

import { calendarSubscriptionSharedMutators } from '../shared-mutators';

function harness(location: 'client' | 'server', result?: unknown) {
  const insert = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  return {
    tx: {
      location,
      run: vi.fn(async () => result),
      mutate: { calendar_subscription: { insert, update, delete: remove } },
    },
    insert,
    update,
    remove,
  };
}

const ctx = { userID: 'user-1' };

beforeEach(() => vi.clearAllMocks());

describe('calendar subscription shared mutator branches A04', () => {
  it('subscribes with the authenticated actor and creation time', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const test = harness('client');

    await calendarSubscriptionSharedMutators.subscribe.fn({
      tx: test.tx,
      ctx,
      args: {
        id: 'subscription-1',
        target_type: 'group',
        target_group_id: 'group-1',
        target_user_id: null,
        is_visible: true,
        color: null,
      },
    } as never);

    expect(auth.requireAuthenticated).toHaveBeenCalledWith(
      test.tx,
      ctx,
      expect.objectContaining({ action: 'create' })
    );
    expect(test.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', created_at: 1234 })
    );
  });

  it('updates and deletes optimistically on clients without an ownership query', async () => {
    const test = harness('client');

    await calendarSubscriptionSharedMutators.update.fn({
      tx: test.tx,
      ctx,
      args: { id: 'subscription-1', color: '#123456' },
    } as never);
    await calendarSubscriptionSharedMutators.unsubscribe.fn({
      tx: test.tx,
      ctx,
      args: { id: 'subscription-1' },
    } as never);

    expect(test.tx.run).not.toHaveBeenCalled();
    expect(auth.requireOwner).not.toHaveBeenCalled();
    expect(test.update).toHaveBeenCalledWith({ id: 'subscription-1', color: '#123456' });
    expect(test.remove).toHaveBeenCalledWith({ id: 'subscription-1' });
  });

  it('authorizes server updates and deletes against both present and absent owners', async () => {
    const present = harness('server', { user_id: 'user-1' });
    await calendarSubscriptionSharedMutators.update.fn({
      tx: present.tx,
      ctx,
      args: { id: 'subscription-1', is_visible: false },
    } as never);

    const absent = harness('server');
    await calendarSubscriptionSharedMutators.unsubscribe.fn({
      tx: absent.tx,
      ctx,
      args: { id: 'subscription-2' },
    } as never);

    expect(auth.requireOwner).toHaveBeenNthCalledWith(
      1,
      present.tx,
      ctx,
      'user-1',
      expect.objectContaining({ action: 'update' })
    );
    expect(auth.requireOwner).toHaveBeenNthCalledWith(
      2,
      absent.tx,
      ctx,
      undefined,
      expect.objectContaining({ action: 'delete' })
    );
  });
});
