import { useCallback, useMemo, useRef, type CSSProperties } from 'react';

import { FeedStatePanel } from '@/features/shared/ui/feed';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import type { Notification } from '../types/notification.types';
import { NotificationItem } from './NotificationItem';
import { queries } from '@/zero/queries';
import { rowAttributes, usePolityZeroWindowList } from '@/features/shared/virtualization';

interface NotificationStart {
  created_at: number;
  id: string;
}

export interface NotificationVirtualQuery {
  key: string;
  tab: 'all' | 'unread' | 'read' | 'personal' | 'entity';
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
  onDeleteNotification?: (notificationId: string, e: React.MouseEvent) => void | Promise<void>;
  formatTime?: (date: string | number) => string;
  mode?: 'global' | 'entity';
  showRecipientBadge?: boolean;
  virtualQuery?: NotificationVirtualQuery;
}

function VirtualNotificationsList({
  queryConfig,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  onNotificationClick,
  onDeleteNotification,
  formatTime,
  mode,
  showRecipientBadge,
}: Omit<NotificationsListProps, 'notifications' | 'isLoading' | 'virtualQuery'> & {
  queryConfig: NotificationVirtualQuery;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const listContextParams = useMemo(
    () => ({
      tab: queryConfig.tab,
      query: queryConfig.searchQuery.trim(),
      entityId: queryConfig.entityId ?? null,
      entityType: queryConfig.entityType ?? null,
    }),
    [queryConfig]
  );
  const virtualList = usePolityZeroWindowList<
    typeof listContextParams,
    Notification,
    NotificationStart
  >({
    scrollStateKey: `notifications-${queryConfig.key}`,
    listContextParams,
    getScrollElement: useCallback(() => contentRef.current, []),
    estimateSize: useCallback(() => 104, []),
    overscan: 8,
    getRowKey: notification => notification.id,
    toStartRow: notification => ({
      created_at: Number(notification.created_at),
      id: notification.id,
    }),
    getPageQuery: useCallback(
      ({ limit, start, dir, settled }) => ({
        query: queries.notifications.page({ ...listContextParams, limit, start, dir }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      [listContextParams]
    ),
    getSingleQuery: useCallback(
      ({ id, settled }) => ({
        query: queries.notifications.byId({ id }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      []
    ),
    permalinkID: queryConfig.permalinkID ?? undefined,
  });

  if (virtualList.rowsEmpty) {
    return <FeedStatePanel icon={EmptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div
      ref={contentRef}
      data-slot="feed-list"
      className="space-y-3"
      style={{ paddingTop: virtualList.spaceBefore, paddingBottom: virtualList.spaceAfter }}
    >
      {virtualList.items.map(item => (
        <div
          key={item.key}
          {...rowAttributes(item.index, item.key)}
          data-slot="notification-list-item"
          className="civic-load-card-reveal"
          style={{ '--civic-load-index': Math.min(item.index, 11) } as CSSProperties}
        >
          {item.row ? (
            <NotificationItem
              notification={item.row}
              onNotificationClick={onNotificationClick}
              onDeleteNotification={onDeleteNotification}
              formatTime={formatTime}
              mode={mode}
              showRecipientBadge={showRecipientBadge}
            />
          ) : (
            <SectionSkeleton rows={1} />
          )}
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
  onDeleteNotification,
  formatTime,
  mode = 'global',
  showRecipientBadge = true,
  virtualQuery,
}: NotificationsListProps) {
  if (virtualQuery) {
    return (
      <VirtualNotificationsList
        queryConfig={virtualQuery}
        emptyIcon={EmptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onNotificationClick={onNotificationClick}
        onDeleteNotification={onDeleteNotification}
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
            onDeleteNotification={onDeleteNotification}
            formatTime={formatTime}
            mode={mode}
            showRecipientBadge={showRecipientBadge}
          />
        </div>
      ))}
    </div>
  );
}
