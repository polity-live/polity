import { describe, expect, it } from 'vitest';
import type { Notification } from '../../types/notification.types';
import {
  filterAccessibleNotifications,
  getNotificationNavigationTarget,
} from '../notificationHelpers';

function createNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    recipient_id: 'user-recipient',
    sender_id: 'user-sender',
    title: 'Test notification',
    message: 'Test message',
    type: 'event_invite',
    action_url: null,
    is_read: false,
    related_entity_type: null,
    on_behalf_of_entity_type: null,
    on_behalf_of_entity_id: null,
    recipient_entity_type: null,
    recipient_entity_id: null,
    related_user_id: null,
    related_group_id: null,
    related_amendment_id: null,
    related_event_id: null,
    related_blog_id: null,
    on_behalf_of_group_id: null,
    on_behalf_of_event_id: null,
    on_behalf_of_amendment_id: null,
    on_behalf_of_blog_id: null,
    recipient_group_id: null,
    recipient_event_id: null,
    recipient_amendment_id: null,
    recipient_blog_id: null,
    category: null,
    created_at: Date.now(),
    ...overrides,
  } as Notification;
}

function notificationOverrides(overrides: unknown): Partial<Notification> {
  return overrides as Partial<Notification>;
}

describe('getNotificationNavigationTarget', () => {
  it('routes event invites to memberships page', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'event_invite',
        recipient_id: 'user-123',
        action_url: '/event/event-42/participants',
      })
    );

    expect(target).toEqual({
      kind: 'route',
      to: '/user/user-123/memberships',
    });
  });

  it('preserves messages deep links from action url', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'direct_message',
        action_url: '/messages?conversationId=conv-99&name=Test',
      })
    );

    expect(target).toEqual({
      kind: 'messages',
      search: {
        conversationId: 'conv-99',
        name: 'Test',
        new: undefined,
        openAriaKai: undefined,
        search: undefined,
        userId: undefined,
        userSearch: undefined,
      },
    });
  });

  it('uses generic route fallback for other action urls', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'membership_request',
        action_url: '/group/group-1/memberships',
      })
    );

    expect(target).toEqual({
      kind: 'route',
      to: '/group/group-1/memberships',
    });
  });
});

describe('filterAccessibleNotifications', () => {
  it('keeps direct personal notifications for the current user', () => {
    const result = filterAccessibleNotifications(
      [
        createNotification(
          notificationOverrides({
            recipient: { id: 'user-1' },
          })
        ),
        createNotification(
          notificationOverrides({
            id: 'notif-2',
            recipient: { id: 'user-2' },
          })
        ),
      ],
      'user-1'
    );

    expect(result.map(notification => notification.id)).toEqual(['notif-1']);
  });

  it('keeps group entity notifications when the user has notification rights', () => {
    const result = filterAccessibleNotifications(
      [
        createNotification(
          notificationOverrides({
            recipient_group: {
              memberships: [
                {
                  membership_roles: [
                    {
                      role: {
                        action_rights: [
                          {
                            resource: 'groupNotifications',
                            action: 'viewNotifications',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          })
        ),
      ],
      'user-1'
    );

    expect(result).toHaveLength(1);
  });

  it('filters entity notifications when the user lacks notification rights', () => {
    const result = filterAccessibleNotifications(
      [
        createNotification(
          notificationOverrides({
            recipient_event: {
              participants: [
                {
                  participant_roles: [
                    {
                      role: {
                        action_rights: [
                          {
                            resource: 'events',
                            action: 'view',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          })
        ),
      ],
      'user-1'
    );

    expect(result).toEqual([]);
  });
});
