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
  setNotificationReadSchema,
  setAllNotificationsReadSchema,
  notificationStateTargetSchema,
  updateEntityNotificationSchema,
  createEntityNotificationSchema,
} from './schema';
import { applyActiveNotificationState, applyNotificationViewAccess } from './queries';

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
  },
  action: 'viewNotifications' | 'manageNotifications' = 'viewNotifications'
) {
  if (tx.location === 'client') return;

  requireAuthenticated(tx, ctx, { action, resource: 'notifications' });

  const groupId =
    scope.recipient_group_id ??
    scope.related_group_id ??
    (scope.entity_type === 'group' ? scope.entity_id : null);
  if (groupId) {
    await can(tx, ctx, {
      action,
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
      action,
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
      action,
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
      action,
      resource: 'notifications',
      blogId,
    });
  }
}

type NotificationRow = Awaited<ReturnType<typeof loadNotification>>;

async function loadNotification(tx: Parameters<typeof can>[0], notificationId: string) {
  return tx.run(zql.notification.where('id', notificationId).one());
}

async function requireNotificationView(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  notification: NotificationRow
) {
  if (!notification) {
    requireOwner(tx, ctx, null, { action: 'viewNotifications', resource: 'notifications' });
    return;
  }
  if (notification.recipient_id) {
    requireOwner(tx, ctx, notification.recipient_id, {
      action: 'viewNotifications',
      resource: 'notifications',
    });
    return;
  }
  await assertCanAccessNotificationScope(tx, ctx, notification);
}

async function deterministicStateId(notificationId: string, userId: string) {
  const input = new TextEncoder().encode(`notification-state:${notificationId}:${userId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function writeUserState(
  tx: Parameters<typeof can>[0],
  userId: string,
  notificationId: string,
  fields: {
    read_at?: number | null;
    dismissed_at?: number | null;
    purged_at?: number | null;
  }
) {
  const existing = await tx.run(
    zql.notification_user_state
      .where('notification_id', notificationId)
      .where('user_id', userId)
      .one()
  );
  const now = Date.now();
  if (existing) {
    await tx.mutate.notification_user_state.update({ id: existing.id, ...fields, updated_at: now });
    return;
  }
  await tx.mutate.notification_user_state.insert({
    id: await deterministicStateId(notificationId, userId),
    notification_id: notificationId,
    user_id: userId,
    read_at: null,
    dismissed_at: null,
    purged_at: null,
    created_at: now,
    updated_at: now,
    ...fields,
  });
}

async function isHiddenForUser(
  tx: Parameters<typeof can>[0],
  userId: string,
  notificationId: string
) {
  const state = await tx.run(
    zql.notification_user_state
      .where('notification_id', notificationId)
      .where('user_id', userId)
      .one()
  );
  return Boolean(state?.dismissed_at || state?.purged_at);
}

async function syncLegacyReadState(
  tx: Parameters<typeof can>[0],
  userId: string,
  notification: NonNullable<NotificationRow>,
  read: boolean
) {
  if (!notification.recipient_entity_type || !notification.recipient_entity_id) {
    await tx.mutate.notification.update({ id: notification.id, is_read: read });
    return;
  }

  const legacyReads = await tx.run(
    zql.notification_read.where('notification_id', notification.id).where('read_by_user_id', userId)
  );
  if (read && legacyReads.length === 0) {
    await tx.mutate.notification_read.insert({
      id: await deterministicStateId(notification.id, userId),
      notification_id: notification.id,
      entity_type: notification.recipient_entity_type,
      entity_id: notification.recipient_entity_id,
      read_by_user_id: userId,
      read_at: Date.now(),
    });
  }
  if (!read) {
    for (const legacyRead of legacyReads) {
      await tx.mutate.notification_read.delete({ id: legacyRead.id });
    }
  }
}

async function setReadState(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  notificationId: string,
  read: boolean
) {
  const notification = await loadNotification(tx, notificationId);
  if (tx.location !== 'client') await requireNotificationView(tx, ctx, notification);
  if (!notification) return;
  await writeUserState(tx, ctx.userID, notification.id, { read_at: read ? Date.now() : null });
  await syncLegacyReadState(tx, ctx.userID, notification, read);
}

async function setDismissedState(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  notificationId: string,
  mode: 'dismiss' | 'restore' | 'purge'
) {
  const notification = await loadNotification(tx, notificationId);
  if (tx.location !== 'client') await requireNotificationView(tx, ctx, notification);
  if (!notification) return;
  const now = Date.now();
  await writeUserState(
    tx,
    ctx.userID,
    notification.id,
    mode === 'dismiss'
      ? { dismissed_at: now, purged_at: null }
      : mode === 'restore'
        ? { dismissed_at: null, purged_at: null }
        : { dismissed_at: now, purged_at: now }
  );
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const notificationSharedMutators = {
  setNotificationRead: defineMutator(setNotificationReadSchema, async ({ tx, ctx, args }) => {
    await setReadState(tx, ctx, args.notificationId, args.read);
  }),

  setAllNotificationsRead: defineMutator(
    setAllNotificationsReadSchema,
    async ({ tx, ctx, args }) => {
      requireAuthenticated(tx, ctx, { action: 'update', resource: 'notifications' });
      let query: any = applyActiveNotificationState(
        applyNotificationViewAccess(zql.notification, ctx.userID),
        ctx.userID
      );
      if (args.scope.kind === 'entity') {
        query = query
          .where('recipient_entity_type', args.scope.entityType)
          .where('recipient_entity_id', args.scope.entityId);
      }
      const notifications = (await tx.run(query)) as NonNullable<NotificationRow>[];
      for (const notification of notifications) {
        if (await isHiddenForUser(tx, ctx.userID, notification.id)) continue;
        await writeUserState(tx, ctx.userID, notification.id, {
          read_at: args.read ? Date.now() : null,
        });
        await syncLegacyReadState(tx, ctx.userID, notification, args.read);
      }
    }
  ),

  dismissNotification: defineMutator(notificationStateTargetSchema, async ({ tx, ctx, args }) => {
    await setDismissedState(tx, ctx, args.notificationId, 'dismiss');
  }),

  restoreNotification: defineMutator(notificationStateTargetSchema, async ({ tx, ctx, args }) => {
    await setDismissedState(tx, ctx, args.notificationId, 'restore');
  }),

  purgeNotificationForUser: defineMutator(
    notificationStateTargetSchema,
    async ({ tx, ctx, args }) => {
      await setDismissedState(tx, ctx, args.notificationId, 'purge');
    }
  ),

  // Mark a single notification as read
  markRead: defineMutator(markReadNotificationSchema, async ({ tx, ctx, args }) => {
    await setReadState(tx, ctx, args.id, true);
  }),

  // Mark all notifications as read for the current user
  markAllRead: defineMutator(markReadNotificationSchema, async ({ tx, ctx }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'update', resource: 'notifications' });
    const unread = (await tx.run(
      applyActiveNotificationState(applyNotificationViewAccess(zql.notification, userID), userID)
    )) as NonNullable<NotificationRow>[];

    for (const n of unread) {
      if (await isHiddenForUser(tx, userID, n.id)) continue;
      await writeUserState(tx, userID, n.id, { read_at: Date.now() });
      await syncLegacyReadState(tx, userID, n, true);
    }
  }),

  // Delete a notification
  delete: defineMutator(deleteNotificationSchema, async ({ tx, ctx, args }) => {
    await setDismissedState(tx, ctx, args.id, 'dismiss');
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
      updated_at: now,
      deleted_at: null,
      deleted_by_user_id: null,
    });
  }),

  createEntityNotification: defineMutator(
    createEntityNotificationSchema,
    async ({ tx, ctx, args }) => {
      await assertCanAccessNotificationScope(
        tx,
        ctx,
        {
          entity_type: args.recipient_entity_type,
          entity_id: args.recipient_entity_id,
          recipient_group_id: args.recipient_group_id,
          recipient_event_id: args.recipient_event_id,
          recipient_amendment_id: args.recipient_amendment_id,
          recipient_blog_id: args.recipient_blog_id,
        },
        'manageNotifications'
      );
      const now = Date.now();
      await tx.mutate.notification.insert({
        ...args,
        recipient_id: null,
        sender_id: ctx.userID,
        is_read: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        deleted_by_user_id: null,
      });
    }
  ),

  updateEntityNotification: defineMutator(
    updateEntityNotificationSchema,
    async ({ tx, ctx, args }) => {
      const notification = await loadNotification(tx, args.notificationId);
      if (tx.location !== 'client') {
        if (!notification?.recipient_entity_id || !notification.recipient_entity_type) {
          requireOwner(tx, ctx, null, { action: 'update', resource: 'notifications' });
        } else {
          await assertCanAccessNotificationScope(tx, ctx, notification, 'manageNotifications');
        }
      }
      if (!notification) return;
      const { notificationId, ...fields } = args;
      await tx.mutate.notification.update({
        id: notificationId,
        ...fields,
        updated_at: Date.now(),
      });
    }
  ),

  deleteEntityNotificationGlobally: defineMutator(
    notificationStateTargetSchema,
    async ({ tx, ctx, args }) => {
      const notification = await loadNotification(tx, args.notificationId);
      if (tx.location !== 'client') {
        if (!notification?.recipient_entity_id || !notification.recipient_entity_type) {
          requireOwner(tx, ctx, null, { action: 'delete', resource: 'notifications' });
        } else {
          await assertCanAccessNotificationScope(tx, ctx, notification, 'manageNotifications');
        }
      }
      if (!notification) return;
      await tx.mutate.notification.update({
        id: notification.id,
        deleted_at: Date.now(),
        deleted_by_user_id: ctx.userID,
        updated_at: Date.now(),
      });
    }
  ),

  restoreEntityNotificationGlobally: defineMutator(
    notificationStateTargetSchema,
    async ({ tx, ctx, args }) => {
      const notification = await loadNotification(tx, args.notificationId);
      if (tx.location !== 'client') {
        if (!notification?.recipient_entity_id || !notification.recipient_entity_type) {
          requireOwner(tx, ctx, null, { action: 'update', resource: 'notifications' });
        } else {
          await assertCanAccessNotificationScope(tx, ctx, notification, 'manageNotifications');
        }
      }
      if (!notification) return;
      await tx.mutate.notification.update({
        id: notification.id,
        deleted_at: null,
        deleted_by_user_id: null,
        updated_at: Date.now(),
      });
    }
  ),

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
      await setReadState(tx, ctx, args.notification_id, true);
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
      const entityNotifications = (await tx.run(
        applyActiveNotificationState(
          applyNotificationViewAccess(
            zql.notification
              .where('recipient_entity_id', args.entity_id)
              .where('recipient_entity_type', args.entity_type),
            userID
          ),
          userID
        )
      )) as NonNullable<NotificationRow>[];
      for (const n of entityNotifications) {
        if (await isHiddenForUser(tx, userID, n.id)) continue;
        await writeUserState(tx, userID, n.id, { read_at: Date.now() });
        await syncLegacyReadState(tx, userID, n, true);
      }
    }
  ),

  // Delete a notification read record
  deleteEntityNotificationRead: defineMutator(
    deleteNotificationReadSchema,
    async ({ tx, ctx, args }) => {
      const read = await tx.run(zql.notification_read.where('id', args.id).one());
      if (tx.location !== 'client') {
        requireOwner(tx, ctx, read?.read_by_user_id, {
          action: 'delete',
          resource: 'notifications',
        });
      }
      if (!read) return;
      await setReadState(tx, ctx, read.notification_id, false);
    }
  ),
};
