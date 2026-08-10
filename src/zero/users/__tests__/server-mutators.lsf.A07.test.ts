import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  follow: vi.fn(async () => undefined),
  fireNotification: vi.fn(async () => undefined),
  userName: vi.fn(async () => 'Ada Lovelace'),
}));

vi.mock('../../mutators', () => ({
  mutators: { users: { follow: { fn: mocks.follow } } },
}));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../server-helpers', () => ({ userName: mocks.userName }));

import { userServerMutators } from '../server-mutators';

beforeEach(() => vi.clearAllMocks());

describe('A07 user server mutator adapter', () => {
  it('delegates the follow and notifies the followed user with the resolved sender name', async () => {
    const tx = { run: vi.fn() };
    const ctx = { userID: 'user-1', email: 'ada@example.org' };
    const args = { id: 'follow-1', follower_id: 'user-1', followee_id: 'user-2' };

    await userServerMutators.follow.fn({ tx: tx as never, ctx, args });

    expect(mocks.follow).toHaveBeenCalledWith({ tx, ctx, args });
    expect(mocks.userName).toHaveBeenCalledWith(tx, 'user-1');
    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyNewFollower', {
      senderId: 'user-1',
      senderName: 'Ada Lovelace',
      recipientUserId: 'user-2',
    });
  });
});
