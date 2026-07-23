import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sharedSubscribe: vi.fn(),
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
});
