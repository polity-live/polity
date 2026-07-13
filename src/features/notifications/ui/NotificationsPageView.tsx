import type { MouseEvent } from 'react';
import { Bell, Check, Users } from 'lucide-react';

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
  };
  onMarkAllAsRead: () => void | Promise<void>;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  onDeleteNotification: (notificationId: string, event: MouseEvent) => void | Promise<void>;
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
  onNotificationClick,
  onDeleteNotification,
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
            <div className="min-w-0 flex-1">
              <NotificationTabs
                allCount={counts.all}
                unreadCount={counts.unread}
                personalCount={counts.personal}
                entityCount={counts.entity}
              />
            </div>
            <NotificationHeader unreadCount={unreadCount} onMarkAllAsRead={onMarkAllAsRead} />
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
            onDeleteNotification={onDeleteNotification}
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
            onDeleteNotification={onDeleteNotification}
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
            onDeleteNotification={onDeleteNotification}
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
            onDeleteNotification={onDeleteNotification}
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
            onDeleteNotification={onDeleteNotification}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
