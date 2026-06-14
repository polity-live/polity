import type { MouseEvent, RefObject } from 'react';
import { Bell, Check, Users } from 'lucide-react';

import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar';
import { FeedToolbar } from '@/features/shared/ui/feed';
import { Tabs, TabsContent } from '@/features/shared/ui/ui/tabs';
import type { Notification } from '../types/notification.types';
import { NotificationHeader } from './NotificationHeader';
import { NotificationsList } from './NotificationsList';
import { NotificationTabs } from './NotificationTabs';

interface NotificationBuckets {
  all: Notification[];
  unread: Notification[];
  read: Notification[];
  personal: Notification[];
  entity: Notification[];
}

export interface NotificationsPageViewProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  unreadCount: number;
  searchFilteredNotifications: NotificationBuckets;
  paginatedNotifications: NotificationBuckets;
  isInitialLoading: boolean;
  hasMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
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
  unreadCount,
  searchFilteredNotifications,
  paginatedNotifications,
  isInitialLoading,
  hasMore,
  loadMoreRef,
  labels,
  onMarkAllAsRead,
  onNotificationClick,
  onDeleteNotification,
}: NotificationsPageViewProps) {
  return (
    <div>
      <Tabs defaultValue="all" className="w-full">
        <FeedToolbar>
          <NotificationHeader unreadCount={unreadCount} onMarkAllAsRead={onMarkAllAsRead} />

          <div className="mb-4">
            <EntitySearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              placeholder={labels.searchPlaceholder}
            />
          </div>

          <NotificationTabs
            allCount={searchFilteredNotifications.all.length}
            unreadCount={searchFilteredNotifications.unread.length}
            personalCount={searchFilteredNotifications.personal.length}
            entityCount={searchFilteredNotifications.entity.length}
          />
        </FeedToolbar>

        <TabsContent value="all" className="mt-0">
          <NotificationsList
            notifications={paginatedNotifications.all}
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
            notifications={paginatedNotifications.unread}
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
            notifications={paginatedNotifications.read}
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
            notifications={paginatedNotifications.personal}
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
            notifications={paginatedNotifications.entity}
            isLoading={isInitialLoading}
            emptyIcon={Users}
            emptyTitle={labels.emptyEntityTitle}
            emptyDescription={labels.emptyEntityDescription}
            onNotificationClick={onNotificationClick}
            onDeleteNotification={onDeleteNotification}
          />
        </TabsContent>

        {hasMore ? <div ref={loadMoreRef} className="h-px" /> : null}
      </Tabs>
    </div>
  );
}
