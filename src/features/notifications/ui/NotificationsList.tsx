import { type CSSProperties } from 'react';
import { useQuery } from '@rocicorp/zero/react';

import { FeedStatePanel } from '@/features/shared/ui/feed';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import type { Notification } from '../types/notification.types';
import { NotificationItem } from './NotificationItem';
import { queries } from '@/zero/queries';
import {
  isNotificationActive,
  isNotificationDismissed,
  isNotificationPurged,
  isNotificationRead,
} from '@/zero/notifications/notificationReadState';

export interface NotificationVirtualQuery {
  key: string;
  tab: 'all' | 'unread' | 'read' | 'personal' | 'entity' | 'trash';
  searchQuery: string;
  entityId?: string | null;
  entityType?: string | null;
  permalinkID?: string | null;
}

interface NotificationsListProps {
  notifications?: Notification[];
  isLoading?: boolean;
  emptyIcon: React.ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  onMarkAsRead?: (notification: Notification, e: React.MouseEvent) => void | Promise<void>;
  onToggleRead?: (notification: Notification, e: React.MouseEvent) => void | Promise<void>;
  onDeleteNotification?: (notificationId: string, e: React.MouseEvent) => void | Promise<void>;
  onRestoreNotification?: (notificationId: string, e: React.MouseEvent) => void | Promise<void>;
  onPurgeNotification?: (notificationId: string, e: React.MouseEvent) => void | Promise<void>;
  onDeleteForEveryone?: (notificationId: string) => void | Promise<void>;
  canDeleteForEveryone?: (notification: Notification) => boolean;
  formatTime?: (date: string | number) => string;
  mode?: 'global' | 'entity' | 'trash';
  showRecipientBadge?: boolean;
  virtualQuery?: NotificationVirtualQuery;
}

function VirtualNotificationsList({
  queryConfig,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  onNotificationClick,
  onMarkAsRead,
  onToggleRead,
  onDeleteNotification,
  onRestoreNotification,
  onPurgeNotification,
  onDeleteForEveryone,
  canDeleteForEveryone,
  formatTime,
  mode,
  showRecipientBadge,
}: Omit<NotificationsListProps, 'notifications' | 'isLoading' | 'virtualQuery'> & {
  queryConfig: NotificationVirtualQuery;
}) {
  const [rows, result] = useQuery(
    queries.notifications.countRows({
      tab: queryConfig.tab,
      query: queryConfig.searchQuery.trim(),
      entityId: queryConfig.entityId ?? null,
      entityType: queryConfig.entityType ?? null,
    })
  );
  const visibleRows = (rows ?? []).filter(notification => {
    if (queryConfig.tab === 'trash') {
      return isNotificationDismissed(notification) && !isNotificationPurged(notification);
    }
    if (!isNotificationActive(notification)) return false;
    if (queryConfig.tab === 'unread') return !isNotificationRead(notification);
    if (queryConfig.tab === 'read') return isNotificationRead(notification);
    return true;
  });

  if (result.type === 'unknown') return <SectionSkeleton rows={5} />;
  if (visibleRows.length === 0) {
    return <FeedStatePanel icon={EmptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div data-slot="feed-list" className="space-y-3">
      {visibleRows.map((notification, index) => (
        <div
          key={notification.id}
          data-slot="notification-list-item"
          className="civic-load-card-reveal"
          style={{ '--civic-load-index': Math.min(index, 11) } as CSSProperties}
        >
          <NotificationItem
            notification={notification}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onRestoreNotification={onRestoreNotification}
            onPurgeNotification={onPurgeNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone?.(notification) ?? false}
            formatTime={formatTime}
            mode={mode}
            showRecipientBadge={showRecipientBadge}
          />
        </div>
      ))}
    </div>
  );
}

export function NotificationsList({
  notifications = [],
  isLoading,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  onNotificationClick,
  onMarkAsRead,
  onToggleRead,
  onDeleteNotification,
  onRestoreNotification,
  onPurgeNotification,
  onDeleteForEveryone,
  canDeleteForEveryone,
  formatTime,
  mode = 'global',
  showRecipientBadge = true,
  virtualQuery,
}: NotificationsListProps) {
  if (virtualQuery && notifications.length === 0) {
    return (
      <VirtualNotificationsList
        queryConfig={virtualQuery}
        emptyIcon={EmptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onNotificationClick={onNotificationClick}
        onMarkAsRead={onMarkAsRead}
        onToggleRead={onToggleRead}
        onDeleteNotification={onDeleteNotification}
        onRestoreNotification={onRestoreNotification}
        onPurgeNotification={onPurgeNotification}
        onDeleteForEveryone={onDeleteForEveryone}
        canDeleteForEveryone={canDeleteForEveryone}
        formatTime={formatTime}
        mode={mode}
        showRecipientBadge={showRecipientBadge}
      />
    );
  }
  if (isLoading) {
    return <SectionSkeleton rows={5} />;
  }

  if (notifications.length === 0) {
    return <FeedStatePanel icon={EmptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div data-slot="feed-list" className="space-y-3">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          data-slot="notification-list-item"
          className="civic-load-card-reveal"
          style={
            {
              '--civic-load-index': Math.min(index, 11),
            } as CSSProperties
          }
        >
          <NotificationItem
            notification={notification}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onRestoreNotification={onRestoreNotification}
            onPurgeNotification={onPurgeNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone?.(notification) ?? false}
            formatTime={formatTime}
            mode={mode}
            showRecipientBadge={showRecipientBadge}
          />
        </div>
      ))}
    </div>
  );
}
