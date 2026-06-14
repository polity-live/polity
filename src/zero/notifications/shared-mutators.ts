import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
import { can } from '../rbac/can';
import {
  denyPublicApiMutation,
  requireActorMatches,
  requireAuthenticated,
  requireOwner,
} from '../rbac/authorize';
import {
  createNotificationSchema,
  markReadNotificationSchema,
  deleteNotificationSchema,
  createNotificationSettingSchema,
  updateNotificationSettingSchema,
  createPushSubscriptionSchema,
  deletePushSubscriptionSchema,
  createNotificationReadSchema,
  deleteNotificationReadSchema,
} from './schema';

async function assertCanAccessNotificationScope(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  scope: {
    entity_type?: string | null;
    entity_id?: string | null;
    recipient_group_id?: string | null;
    recipient_event_id?: string | null;
    recipient_amendment_id?: string | null;
    recipient_blog_id?: string | null;
    related_group_id?: string | null;
    related_event_id?: string | null;
    related_amendment_id?: string | null;
    related_blog_id?: string | null;
  }
) {
  if (tx.location === 'client') return;

  requireAuthenticated(tx, ctx, { action: 'viewNotifications', resource: 'notifications' });

  const groupId =
    scope.recipient_group_id ??
    scope.related_group_id ??
    (scope.entity_type === 'group' ? scope.entity_id : null);
  if (groupId) {
    await can(tx, ctx, {
      action: 'viewNotifications',
      resource: 'groupNotifications',
      groupId,
    });
    return;
  }

  const eventId =
    scope.recipient_event_id ??
    scope.related_event_id ??
    (scope.entity_type === 'event' ? scope.entity_id : null);
  if (eventId) {
    await can(tx, ctx, {
      action: 'viewNotifications',
      resource: 'notifications',
      eventId,
    });
    return;
  }

  const amendmentId =
    scope.recipient_amendment_id ??
    scope.related_amendment_id ??
    (scope.entity_type === 'amendment' ? scope.entity_id : null);
  if (amendmentId) {
    await can(tx, ctx, {
      action: 'viewNotifications',
      resource: 'notifications',
      amendmentId,
    });
    return;
  }

  const blogId =
    scope.recipient_blog_id ??
    scope.related_blog_id ??
    (scope.entity_type === 'blog' ? scope.entity_id : null);
  if (blogId) {
    await can(tx, ctx, {
      action: 'viewNotifications',
      resource: 'notifications',
      blogId,
    });
  }
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const notificationSharedMutators = {
  // Mark a single notification as read
  markRead: defineMutator(markReadNotificationSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const notification = await tx.run(zql.notification.where('id', args.id).one());
      if (notification?.recipient_id) {
        requireOwner(tx, ctx, notification.recipient_id, {
          action: 'update',
          resource: 'notifications',
        });
      } else if (notification) {
        await assertCanAccessNotificationScope(tx, ctx, notification);
      } else {
        requireOwner(tx, ctx, null, { action: 'update', resource: 'notifications' });
      }
    }

    await tx.mutate.notification.update({
      id: args.id,
      is_read: true,
    });
  }),

  // Mark all notifications as read for the current user
  markAllRead: defineMutator(markReadNotificationSchema, async ({ tx, ctx }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'update', resource: 'notifications' });
    const unread = await tx.run(
      zql.notification.where('recipient_id', userID).where('is_read', false)
    );

    for (const n of unread) {
      await tx.mutate.notification.update({
        id: n.id,
        is_read: true,
      });
    }
  }),

  // Delete a notification
  delete: defineMutator(deleteNotificationSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const notification = await tx.run(zql.notification.where('id', args.id).one());
      requireOwner(tx, ctx, notification?.recipient_id, {
        action: 'delete',
        resource: 'notifications',
      });
    }

    await tx.mutate.notification.delete({ id: args.id });
  }),

  // Update notification settings
  updateSettings: defineMutator(updateNotificationSettingSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const settings = await tx.run(zql.notification_setting.where('id', args.id).one());
      requireOwner(tx, ctx, settings?.user_id, {
        action: 'update',
        resource: 'notifications',
      });
    }

    const { id, ...fields } = args;
    await tx.mutate.notification_setting.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  // Register a push subscription
  registerPushSubscription: defineMutator(
    createPushSubscriptionSchema,
    async ({ tx, ctx, args }) => {
      const { userID } = ctx;
      requireAuthenticated(tx, ctx, { action: 'create', resource: 'notifications' });
      const now = Date.now();
      await tx.mutate.push_subscription.insert({
        ...args,
        user_id: userID,
        created_at: now,
        updated_at: now,
      });
    }
  ),

  // Unregister a push subscription
  unregisterPushSubscription: defineMutator(
    deletePushSubscriptionSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const subscription = await tx.run(zql.push_subscription.where('id', args.id).one());
        requireOwner(tx, ctx, subscription?.user_id, {
          action: 'delete',
          resource: 'notifications',
        });
      }

      await tx.mutate.push_subscription.delete({ id: args.id });
    }
  ),

  // Create a notification
  createNotification: defineMutator(createNotificationSchema, async ({ tx, ctx, args }) => {
    denyPublicApiMutation(tx, {
      action: 'create',
      resource: 'notifications',
      scope: 'notification-dispatch',
    });
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'notifications' });
    if (args.sender_id) {
      requireActorMatches(tx, ctx, args.sender_id, {
        action: 'create',
        resource: 'notifications',
      });
    }
    await assertCanAccessNotificationScope(tx, ctx, {
      ...args,
      entity_type: args.recipient_entity_type ?? args.related_entity_type,
      entity_id: args.recipient_entity_id ?? null,
    });

    const now = Date.now();
    await tx.mutate.notification.insert({
      ...args,
      sender_id: args.sender_id ?? ctx.userID,
      is_read: false,
      created_at: now,
    });
  }),

  // Create notification settings
  createSettings: defineMutator(createNotificationSettingSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'notifications' });
    const now = Date.now();
    await tx.mutate.notification_setting.insert({
      ...args,
      user_id: userID,
      created_at: now,
      updated_at: now,
    });
  }),

  // Mark a single entity notification as read
  markEntityNotificationRead: defineMutator(
    createNotificationReadSchema,
    async ({ tx, ctx, args }) => {
      const { userID } = ctx;
      await assertCanAccessNotificationScope(tx, ctx, {
        entity_type: args.entity_type,
        entity_id: args.entity_id,
      });
      const existing = await tx.run(
        zql.notification_read
          .where('notification_id', args.notification_id)
          .where('entity_id', args.entity_id)
          .where('entity_type', args.entity_type)
          .where('read_by_user_id', userID)
      );

      if (existing.length > 0) {
        return;
      }

      await tx.mutate.notification_read.insert({
        ...args,
        read_by_user_id: userID,
        read_at: Date.now(),
      });
    }
  ),

  // Mark all entity notifications as read (batch)
  markAllEntityNotificationsRead: defineMutator(
    createNotificationReadSchema.pick({ entity_id: true, entity_type: true }),
    async ({ tx, ctx, args }) => {
      const { userID } = ctx;
      await assertCanAccessNotificationScope(tx, ctx, {
        entity_type: args.entity_type,
        entity_id: args.entity_id,
      });
      // Get all notifications for this entity that the user hasn't read yet
      const entityNotifications = await tx.run(
        zql.notification
          .where('recipient_entity_id', args.entity_id)
          .where('recipient_entity_type', args.entity_type)
      );

      const existingReads = await tx.run(
        zql.notification_read
          .where('entity_id', args.entity_id)
          .where('entity_type', args.entity_type)
          .where('read_by_user_id', userID)
      );

      const readNotificationIds = new Set(existingReads.map(r => r.notification_id));
      const now = Date.now();

      for (const n of entityNotifications) {
        if (!readNotificationIds.has(n.id)) {
          await tx.mutate.notification_read.insert({
            id: crypto.randomUUID(),
            notification_id: n.id,
            entity_id: args.entity_id,
            entity_type: args.entity_type,
            read_by_user_id: userID,
            read_at: now,
          });
        }
      }
    }
  ),

  // Delete a notification read record
  deleteEntityNotificationRead: defineMutator(
    deleteNotificationReadSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const read = await tx.run(zql.notification_read.where('id', args.id).one());
        requireOwner(tx, ctx, read?.read_by_user_id, {
          action: 'delete',
          resource: 'notifications',
        });
      }

      await tx.mutate.notification_read.delete({ id: args.id });
    }
  ),
};
