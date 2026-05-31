import { useMemo } from 'react';
import { useNotificationState } from './useNotificationState';

/**
 * Returns the unread notification count for a specific entity.
 * Uses the same is_read field that EntityNotifications page uses.
 */
export function useEntityUnreadCount(entityId: string, entityType: string) {
  const { entityNotifications } = useNotificationState({
    entityFilter: entityId ? { entityId, entityType } : undefined,
  });

  const unreadCount = useMemo(() => {
    if (!entityNotifications) return 0;
    return entityNotifications.filter(n => !n.is_read).length;
  }, [entityNotifications]);

  return unreadCount;
}
