import { useMemo } from 'react';
import { Notification, NotificationFilters } from '../types/notification.types';
import { filterAccessibleNotifications, isNotificationRead } from '../logic/notificationHelpers';

interface UseNotificationFiltersProps {
  notifications: Notification[];
  userId?: string;
}

export function useNotificationFilters({
  notifications,
  userId,
}: UseNotificationFiltersProps): NotificationFilters {
  const accessibleNotifications = useMemo(
    () => filterAccessibleNotifications(notifications, userId),
    [notifications, userId]
  );

  const unreadNotifications = useMemo(() => {
    return accessibleNotifications.filter(n => !isNotificationRead(n));
  }, [accessibleNotifications]);

  const readNotifications = useMemo(() => {
    return accessibleNotifications.filter(isNotificationRead);
  }, [accessibleNotifications]);

  const personalNotifications = useMemo(() => {
    return accessibleNotifications.filter(n => n.recipient?.id === userId);
  }, [accessibleNotifications, userId]);

  const entityNotifications = useMemo(() => {
    return accessibleNotifications.filter(
      n =>
        n.recipient_entity_type ||
        n.on_behalf_of_entity_type ||
        n.recipient_group ||
        n.recipient_event ||
        n.recipient_amendment ||
        n.recipient_blog ||
        n.on_behalf_of_group ||
        n.on_behalf_of_event ||
        n.on_behalf_of_amendment ||
        n.on_behalf_of_blog
    );
  }, [accessibleNotifications]);

  return {
    all: accessibleNotifications,
    unread: unreadNotifications,
    read: readNotifications,
    personal: personalNotifications,
    entity: entityNotifications,
  };
}
