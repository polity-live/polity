import type { MouseEvent } from 'react';
import { Bell, Check, Trash2, Users } from 'lucide-react';

import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { FeedToolbar } from '@/features/shared/ui/feed';
import { Tabs, TabsContent } from '@/features/shared/ui/ui/tabs';
import type { Notification } from '../types/notification.types';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';
import type { NotificationTab } from '../hooks/useNotificationsPage';
import { NotificationHeader } from './NotificationHeader';
import { NotificationsList } from './NotificationsList';
import { NotificationTabs } from './NotificationTabs';

interface NotificationCounts {
  all: number;
  unread: number;
  personal: number;
  entity: number;
  trash: number;
}

export interface NotificationsPageViewProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedTab: NotificationTab;
  onSelectedTabChange: (tab: NotificationTab) => void;
  tabSwipeHandlers: SwipeNavigationHandlers;
  unreadCount: number;
  counts: NotificationCounts;
  isInitialLoading: boolean;
  labels: {
    searchPlaceholder: string;
    emptyAllTitle: string;
    emptyAllDescription: string;
    allCaughtUpTitle: string;
    emptyUnreadDescription: string;
    emptyReadTitle: string;
    emptyReadDescription: string;
    emptyPersonalTitle: string;
    emptyPersonalDescription: string;
    emptyEntityTitle: string;
    emptyEntityDescription: string;
    emptyTrashTitle: string;
    emptyTrashDescription: string;
  };
  onMarkAllAsRead: () => void | Promise<void>;
  onMarkAllAsUnread: () => void | Promise<void>;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  onMarkAsRead: (notification: Notification, event: MouseEvent) => void | Promise<void>;
  onDeleteNotification: (notificationId: string, event: MouseEvent) => void | Promise<void>;
  onToggleRead: (notification: Notification, event: MouseEvent) => void | Promise<void>;
  onRestoreNotification: (notificationId: string, event: MouseEvent) => void | Promise<void>;
  onPurgeNotification: (notificationId: string, event: MouseEvent) => void | Promise<void>;
  onDeleteForEveryone: (notificationId: string) => void | Promise<void>;
  canDeleteForEveryone: (notification: Notification) => boolean;
}

export function NotificationsPageView({
  searchQuery,
  onSearchQueryChange,
  selectedTab,
  onSelectedTabChange,
  tabSwipeHandlers,
  unreadCount,
  counts,
  isInitialLoading,
  labels,
  onMarkAllAsRead,
  onMarkAllAsUnread,
  onNotificationClick,
  onMarkAsRead,
  onDeleteNotification,
  onToggleRead,
  onRestoreNotification,
  onPurgeNotification,
  onDeleteForEveryone,
  canDeleteForEveryone,
}: NotificationsPageViewProps) {
  return (
    <div style={{ touchAction: 'pan-y' }} {...tabSwipeHandlers}>
      <Tabs
        value={selectedTab}
        onValueChange={value => onSelectedTabChange(value as NotificationTab)}
        className="w-full"
      >
        <FeedToolbar>
          <div className="mb-4">
            <EntitySearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              placeholder={labels.searchPlaceholder}
            />
          </div>

          <div
            data-slot="notification-controls"
            className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-initial">
              <NotificationTabs
                allCount={counts.all}
                unreadCount={counts.unread}
                personalCount={counts.personal}
                entityCount={counts.entity}
                trashCount={counts.trash}
              />
            </div>
            <NotificationHeader
              unreadCount={unreadCount}
              onMarkAllAsRead={onMarkAllAsRead}
              onMarkAllAsUnread={onMarkAllAsUnread}
            />
          </div>
        </FeedToolbar>

        <TabsContent value="all" className="mt-0">
          <NotificationsList
            virtualQuery={{ key: 'global-all', tab: 'all', searchQuery }}
            isLoading={isInitialLoading}
            emptyIcon={Bell}
            emptyTitle={labels.emptyAllTitle}
            emptyDescription={labels.emptyAllDescription}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
          />
        </TabsContent>

        <TabsContent value="unread" className="mt-0">
          <NotificationsList
            virtualQuery={{ key: 'global-unread', tab: 'unread', searchQuery }}
            isLoading={isInitialLoading}
            emptyIcon={Check}
            emptyTitle={labels.allCaughtUpTitle}
            emptyDescription={labels.emptyUnreadDescription}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
          />
        </TabsContent>

        <TabsContent value="read" className="mt-0">
          <NotificationsList
            virtualQuery={{ key: 'global-read', tab: 'read', searchQuery }}
            isLoading={isInitialLoading}
            emptyIcon={Bell}
            emptyTitle={labels.emptyReadTitle}
            emptyDescription={labels.emptyReadDescription}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
          />
        </TabsContent>

        <TabsContent value="personal" className="mt-0">
          <NotificationsList
            virtualQuery={{ key: 'global-personal', tab: 'personal', searchQuery }}
            isLoading={isInitialLoading}
            emptyIcon={Bell}
            emptyTitle={labels.emptyPersonalTitle}
            emptyDescription={labels.emptyPersonalDescription}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
          />
        </TabsContent>

        <TabsContent value="entity" className="mt-0">
          <NotificationsList
            virtualQuery={{ key: 'global-entity', tab: 'entity', searchQuery }}
            isLoading={isInitialLoading}
            emptyIcon={Users}
            emptyTitle={labels.emptyEntityTitle}
            emptyDescription={labels.emptyEntityDescription}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDeleteNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
          />
        </TabsContent>

        <TabsContent value="trash" className="mt-0">
          <NotificationsList
            virtualQuery={{ key: 'global-trash', tab: 'trash', searchQuery }}
            isLoading={isInitialLoading}
            emptyIcon={Trash2}
            emptyTitle={labels.emptyTrashTitle}
            emptyDescription={labels.emptyTrashDescription}
            onNotificationClick={() => undefined}
            onRestoreNotification={onRestoreNotification}
            onPurgeNotification={onPurgeNotification}
            mode="trash"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
