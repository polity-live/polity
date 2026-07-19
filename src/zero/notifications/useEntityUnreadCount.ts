import { useQuery } from '@rocicorp/zero/react';
import { useMemo } from 'react';
import { queries } from '../queries';
import { isNotificationRead } from './notificationReadState';

export type NotificationEntityType = 'group' | 'event' | 'amendment' | 'blog';

/**
 * Returns the unread notification count for a specific entity.
 * Uses the same is_read field that EntityNotifications page uses.
 */
export function useEntityUnreadCount(entityId: string, entityType: NotificationEntityType) {
  const [entityNotifications] = useQuery(
    entityId ? queries.notifications.byEntity({ entityId, entityType }) : undefined
  );

  const unreadCount = useMemo(() => {
    if (!entityNotifications) return 0;
    return entityNotifications.filter(notification => !isNotificationRead(notification)).length;
  }, [entityNotifications]);

  return unreadCount;
}
