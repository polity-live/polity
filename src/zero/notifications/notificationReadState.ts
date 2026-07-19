export interface ReadableNotification {
  is_read?: boolean;
  recipient_entity_type?: string | null;
  reads?: readonly unknown[] | null;
  viewer_state?:
    | readonly {
        read_at?: number | null;
        dismissed_at?: number | null;
        purged_at?: number | null;
      }[]
    | null;
}

export function isNotificationRead(notification: ReadableNotification): boolean {
  if (notification.viewer_state !== undefined) {
    return Boolean(notification.viewer_state?.[0]?.read_at);
  }
  if (!notification.recipient_entity_type) return Boolean(notification.is_read);
  return (notification.reads?.length ?? 0) > 0;
}

export function isNotificationDismissed(notification: ReadableNotification): boolean {
  return Boolean(notification.viewer_state?.[0]?.dismissed_at);
}

export function isNotificationPurged(notification: ReadableNotification): boolean {
  return Boolean(notification.viewer_state?.[0]?.purged_at);
}

export function isNotificationActive(notification: ReadableNotification): boolean {
  return !isNotificationDismissed(notification) && !isNotificationPurged(notification);
}

export function applyEntityReadState<T extends ReadableNotification>(
  notifications: readonly T[] | undefined | null
) {
  return (notifications ?? []).map(notification => ({
    ...notification,
    is_read: isNotificationRead(notification),
  }));
}
