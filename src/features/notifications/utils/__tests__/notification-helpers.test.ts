import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  notifyAdminPromoted,
  notifyAmendmentOwnerPromoted,
  notifyBloggerRoleChanged,
  setNotificationDispatch,
  type CreateNotificationInput,
} from '../notification-helpers';

const dispatched: CreateNotificationInput[] = [];

afterEach(() => {
  dispatched.length = 0;
  setNotificationDispatch(null);
  vi.restoreAllMocks();
});

function captureNotifications() {
  setNotificationDispatch(async notification => {
    dispatched.push(notification);
  });
}

describe('notification helpers', () => {
  it('creates personal and entity notifications for group admin promotions', async () => {
    captureNotifications();

    await notifyAdminPromoted({
      senderId: 'user-1',
      recipientUserId: 'user-1',
      groupId: 'group-1',
      groupName: 'Group One',
    });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]).toMatchObject({
      recipient_id: 'user-1',
      recipient_group_id: null,
      type: 'group_admin_promoted',
    });
    expect(dispatched[1]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'group',
      recipient_group_id: 'group-1',
      related_user_id: 'user-1',
      type: 'group_admin_promoted',
    });
  });

  it('creates personal and entity notifications for amendment owner promotions', async () => {
    captureNotifications();

    await notifyAmendmentOwnerPromoted({
      senderId: 'user-2',
      recipientUserId: 'user-2',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]).toMatchObject({
      recipient_id: 'user-2',
      recipient_amendment_id: null,
      type: 'amendment_owner_promoted',
    });
    expect(dispatched[1]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'amendment',
      recipient_amendment_id: 'amendment-1',
      related_user_id: 'user-2',
      type: 'amendment_owner_promoted',
    });
  });

  it('keeps blog role changes as personal plus entity notifications', async () => {
    captureNotifications();

    await notifyBloggerRoleChanged({
      senderId: 'user-3',
      recipientUserId: 'user-3',
      blogId: 'blog-1',
      blogTitle: 'Blog One',
      newRole: 'Editor',
    });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]).toMatchObject({
      recipient_id: 'user-3',
      recipient_blog_id: null,
      type: 'blog_role_changed',
    });
    expect(dispatched[1]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'blog',
      recipient_blog_id: 'blog-1',
      related_user_id: 'user-3',
      type: 'blog_role_changed',
    });
  });
});
