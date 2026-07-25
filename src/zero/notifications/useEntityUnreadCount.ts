import { useMemo } from 'react';
import { isNotificationActive, isNotificationRead } from './notificationReadState';
import {
  useEntityNotificationCountRows,
  type NotificationEntityType,
} from './useEntityNotificationCountRows';

export type { NotificationEntityType } from './useEntityNotificationCountRows';

/**
 * Returns the unread notification count for a specific entity.
 * Uses the same is_read field that EntityNotifications page uses.
 */
export function useEntityUnreadCount(entityId: string, entityType: NotificationEntityType) {
  const { rows: entityNotifications } = useEntityNotificationCountRows({
    entityId,
    entityType,
    query: '',
  });

  const unreadCount = useMemo(() => {
    return entityNotifications.filter(
      notification => isNotificationActive(notification) && !isNotificationRead(notification)
    ).length;
  }, [entityNotifications]);

  return unreadCount;
}
