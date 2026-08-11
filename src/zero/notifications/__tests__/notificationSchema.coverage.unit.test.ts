import { describe, expect, it } from 'vitest';

import {
  createEntityNotificationSchema,
  setAllNotificationsReadSchema,
  updateEntityNotificationSchema,
} from '../schema';

function entityNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notification-1',
    recipient_id: null,
    sender_id: 'sender-1',
    title: 'Title',
    message: 'Message',
    type: 'event_update',
    action_url: '/events/event-1',
    related_entity_type: null,
    on_behalf_of_entity_type: null,
    on_behalf_of_entity_id: null,
    recipient_entity_type: 'event',
    recipient_entity_id: 'event-1',
    related_user_id: null,
    related_group_id: null,
    related_amendment_id: null,
    related_event_id: 'event-1',
    related_blog_id: null,
    on_behalf_of_group_id: null,
    on_behalf_of_event_id: null,
    on_behalf_of_amendment_id: null,
    on_behalf_of_blog_id: null,
    recipient_group_id: null,
    recipient_event_id: 'event-1',
    recipient_amendment_id: null,
    recipient_blog_id: null,
    category: 'events',
    ...overrides,
  };
}

describe('notification mutation schemas', () => {
  it('accepts every canonical entity target and both read scopes', () => {
    const typedFields = {
      group: 'recipient_group_id',
      event: 'recipient_event_id',
      amendment: 'recipient_amendment_id',
      blog: 'recipient_blog_id',
    } as const;

    for (const [entityType, field] of Object.entries(typedFields)) {
      const typedTargets = {
        recipient_group_id: null,
        recipient_event_id: null,
        recipient_amendment_id: null,
        recipient_blog_id: null,
        [field]: `${entityType}-1`,
      };
      expect(
        createEntityNotificationSchema.safeParse(
          entityNotification({
            ...typedTargets,
            recipient_entity_type: entityType,
            recipient_entity_id: `${entityType}-1`,
          })
        ).success
      ).toBe(true);
    }

    expect(
      setAllNotificationsReadSchema.safeParse({ scope: { kind: 'inbox' }, read: true }).success
    ).toBe(true);
    expect(
      setAllNotificationsReadSchema.safeParse({
        scope: { kind: 'entity', entityType: 'group', entityId: 'group-1' },
        read: false,
      }).success
    ).toBe(true);
  });

  it.each([
    { recipient_id: 'user-1' },
    { recipient_entity_type: null },
    { recipient_entity_type: 'todo' },
    { recipient_entity_id: null },
    { recipient_event_id: 'other-event' },
    { recipient_group_id: 'group-1' },
  ])('rejects a non-canonical entity recipient: %o', override => {
    expect(createEntityNotificationSchema.safeParse(entityNotification(override)).success).toBe(
      false
    );
  });

  it('requires at least one content field while accepting each individual field', () => {
    expect(
      updateEntityNotificationSchema.safeParse({ notificationId: 'notification-1' }).success
    ).toBe(false);
    expect(
      updateEntityNotificationSchema.safeParse({
        notificationId: 'notification-1',
        title: null,
      }).success
    ).toBe(true);
    expect(
      updateEntityNotificationSchema.safeParse({
        notificationId: 'notification-1',
        message: 'Changed',
      }).success
    ).toBe(true);
    expect(
      updateEntityNotificationSchema.safeParse({
        notificationId: 'notification-1',
        action_url: null,
      }).success
    ).toBe(true);
  });
});
