import { FeedList, FeedStatePanel } from '@/features/shared/ui/feed';
import { Notification } from '../types/notification.types';
import { NotificationItem } from './NotificationItem';

interface NotificationsListProps {
  notifications: Notification[];
  isLoading?: boolean;
  emptyIcon: React.ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  onNotificationClick: (notification: Notification) => void;
  onDeleteNotification: (notificationId: string, e: React.MouseEvent) => void;
}

export function NotificationsList({
  notifications,
  isLoading,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  onNotificationClick,
  onDeleteNotification,
}: NotificationsListProps) {
  if (isLoading) {
    return <FeedStatePanel isLoading />;
  }

  if (notifications.length === 0) {
    return <FeedStatePanel icon={EmptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <FeedList>
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onNotificationClick={onNotificationClick}
          onDeleteNotification={onDeleteNotification}
        />
      ))}
    </FeedList>
  );
}
