import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sharedSubscribe: vi.fn(),
  sharedUnsubscribe: vi.fn(),
  sharedCreateLink: vi.fn(),
  sharedDeleteLink: vi.fn(),
  fireNotification: vi.fn(),
  userName: vi.fn(),
  groupName: vi.fn(),
  eventTitle: vi.fn(),
  amendmentTitle: vi.fn(),
  blogTitle: vi.fn(),
  recomputeUserCounters: vi.fn(),
  recomputeGroupCounters: vi.fn(),
  recomputeEventCounters: vi.fn(),
  recomputeAmendmentCounters: vi.fn(),
  recomputeBlogCounters: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    common: {
      subscribe: { fn: mocks.sharedSubscribe },
      unsubscribe: { fn: mocks.sharedUnsubscribe },
      createLink: { fn: mocks.sharedCreateLink },
      deleteLink: { fn: mocks.sharedDeleteLink },
    },
  },
}));

vi.mock('../../server-notify', () => ({
  fireNotification: mocks.fireNotification,
}));

vi.mock('../../server-helpers', () => ({
  userName: mocks.userName,
  groupName: mocks.groupName,
  eventTitle: mocks.eventTitle,
  amendmentTitle: mocks.amendmentTitle,
  blogTitle: mocks.blogTitle,
  recomputeUserCounters: mocks.recomputeUserCounters,
  recomputeGroupCounters: mocks.recomputeGroupCounters,
  recomputeEventCounters: mocks.recomputeEventCounters,
  recomputeAmendmentCounters: mocks.recomputeAmendmentCounters,
  recomputeBlogCounters: mocks.recomputeBlogCounters,
}));

import { commonServerMutators } from '../server-mutators';

const baseArgs = {
  id: 'subscription-1',
  user_id: null,
  group_id: null,
  amendment_id: null,
  event_id: null,
  blog_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sharedSubscribe.mockResolvedValue(undefined);
  mocks.fireNotification.mockResolvedValue(undefined);
  mocks.userName.mockResolvedValue('Ada Lovelace');
  mocks.groupName.mockResolvedValue('Civic Group');
  mocks.eventTitle.mockResolvedValue('Civic Event');
  mocks.amendmentTitle.mockResolvedValue('Civic Amendment');
  mocks.blogTitle.mockResolvedValue('Civic Blog');
});

describe('commonServerMutators.subscribe notifications', () => {
  it.each([
    {
      field: 'group_id',
      id: 'group-1',
      helper: 'notifyGroupNewSubscriber',
      expected: { groupId: 'group-1', groupName: 'Civic Group' },
    },
    {
      field: 'event_id',
      id: 'event-1',
      helper: 'notifyEventNewSubscriber',
      expected: { eventId: 'event-1', eventTitle: 'Civic Event' },
    },
    {
      field: 'amendment_id',
      id: 'amendment-1',
      helper: 'notifyAmendmentNewSubscriber',
      expected: { amendmentId: 'amendment-1', amendmentTitle: 'Civic Amendment' },
    },
    {
      field: 'blog_id',
      id: 'blog-1',
      helper: 'notifyBlogNewSubscriber',
      expected: {
        blogId: 'blog-1',
        blogTitle: 'Civic Blog',
        groupId: undefined,
        ownerId: undefined,
      },
    },
  ] as const)(
    'passes the resolved sender name to $helper',
    async ({ field, id, helper, expected }) => {
      const tx = {
        run: vi.fn().mockResolvedValue(null),
      };

      await commonServerMutators.subscribe.fn({
        tx: tx as never,
        ctx: { userID: 'user-1', email: 'ada@example.com' },
        args: { ...baseArgs, [field]: id },
      });

      expect(mocks.userName).toHaveBeenCalledTimes(1);
      expect(mocks.userName).toHaveBeenCalledWith(tx, 'user-1');
      expect(mocks.fireNotification).toHaveBeenCalledWith(helper, {
        senderId: 'user-1',
        senderName: 'Ada Lovelace',
        ...expected,
      });
    }
  );

  it('recomputes every supplied counter and follows another user only once', async () => {
    const tx = { run: vi.fn() };
    await commonServerMutators.subscribe.fn({
      tx: tx as never,
      ctx: { userID: 'sender', email: '' },
      args: {
        ...baseArgs,
        user_id: 'recipient',
        group_id: 'group-1',
        event_id: 'event-1',
        amendment_id: 'amendment-1',
        blog_id: 'blog-1',
      },
    });
    expect(mocks.recomputeUserCounters).toHaveBeenCalled();
    expect(mocks.recomputeGroupCounters).toHaveBeenCalled();
    expect(mocks.recomputeEventCounters).toHaveBeenCalled();
    expect(mocks.recomputeAmendmentCounters).toHaveBeenCalled();
    expect(mocks.recomputeBlogCounters).toHaveBeenCalled();

    vi.clearAllMocks();
    await commonServerMutators.subscribe.fn({
      tx: tx as never,
      ctx: { userID: 'sender', email: '' },
      args: { ...baseArgs, user_id: 'recipient' },
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyNewFollower',
      expect.objectContaining({ recipientUserId: 'recipient' })
    );

    vi.clearAllMocks();
    await commonServerMutators.subscribe.fn({
      tx: tx as never,
      ctx: { userID: 'sender', email: '' },
      args: { ...baseArgs, user_id: 'sender' },
    });
    expect(mocks.fireNotification).not.toHaveBeenCalled();
  });

  it('includes resolved blog group and owner recipients', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ id: 'blog-1', group_id: 'group-1' })
        .mockResolvedValueOnce({ user_id: 'owner-1' }),
    };
    await commonServerMutators.subscribe.fn({
      tx: tx as never,
      ctx: { userID: 'sender', email: '' },
      args: { ...baseArgs, blog_id: 'blog-1' },
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyBlogNewSubscriber',
      expect.objectContaining({ groupId: 'group-1', ownerId: 'owner-1' })
    );
  });

  it('handles missing and populated unsubscribe rows', async () => {
    const missingTx = { run: vi.fn().mockResolvedValue(null) };
    await commonServerMutators.unsubscribe.fn({
      tx: missingTx as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'missing' },
    });
    expect(mocks.recomputeUserCounters).not.toHaveBeenCalled();

    const populatedTx = {
      run: vi.fn().mockResolvedValue({
        user_id: 'user-1',
        group_id: 'group-1',
        event_id: 'event-1',
        amendment_id: 'amendment-1',
        blog_id: 'blog-1',
      }),
    };
    await commonServerMutators.unsubscribe.fn({
      tx: populatedTx as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'subscription' },
    });
    expect(mocks.recomputeBlogCounters).toHaveBeenCalledWith(populatedTx, 'blog-1');

    vi.clearAllMocks();
    await commonServerMutators.unsubscribe.fn({
      tx: { run: vi.fn().mockResolvedValue({}) } as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'empty-subscription' },
    });
    expect(mocks.recomputeBlogCounters).not.toHaveBeenCalled();
  });

  it('notifies only group-scoped link creates and persisted group link deletes', async () => {
    const tx = { run: vi.fn() };
    await commonServerMutators.createLink.fn({
      tx: tx as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'link-1', group_id: 'group-1' } as never,
    });
    await commonServerMutators.createLink.fn({
      tx: tx as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'link-2', group_id: null } as never,
    });

    const deleteTx = { run: vi.fn().mockResolvedValueOnce({ group_id: 'group-1' }).mockResolvedValueOnce(null) };
    await commonServerMutators.deleteLink.fn({
      tx: deleteTx as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'link-1' },
    });
    await commonServerMutators.deleteLink.fn({
      tx: deleteTx as never,
      ctx: { userID: 'sender', email: '' },
      args: { id: 'missing-link' },
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyLinkRemoved',
      expect.objectContaining({ groupId: 'group-1' })
    );
  });
});
