import type { MouseEvent } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';

import { BadgeControl } from '@/features/shared/ui/status';
import { EntitySearchBar } from '@/features/shared/ui/typeahead/EntitySearchBar';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { ScrollableTabsList } from '@/features/shared/ui/navigation/ScrollableTabs';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs.tsx';
import type { Notification } from '@/features/notifications/types/notification.types.ts';
import { NotificationsList } from './NotificationsList';

interface EntityNotificationsViewLabels {
  loading: string;
  title: string;
  statusDescription: string;
  markAllRead: string;
  searchPlaceholder: string;
  all: string;
  unread: string;
  read: string;
  noNotificationsYet: string;
  notificationsWillShowHere: string;
  allCaughtUp: string;
  allRead: string;
  noReadNotifications: string;
  readNotificationsAppearHere: string;
}

interface EntityNotificationsViewProps {
  entityId: string;
  entityType: string;
  isLoading: boolean;
  notifications?: Notification[];
  filteredNotifications?: Notification[];
  unreadNotifications?: Notification[];
  readNotifications?: Notification[];
  counts?: { all: number; unread: number };
  unreadCount?: number;
  searchQuery: string;
  labels: EntityNotificationsViewLabels;
  onSearchQueryChange: (query: string) => void;
  onMarkAllAsRead: () => void | Promise<void>;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  onMarkAsRead: (notification: Notification, event: MouseEvent) => void | Promise<void>;
  onToggleRead?: (notification: Notification, event: MouseEvent) => void | Promise<void>;
  onDismissNotification?: (notificationId: string, event: MouseEvent) => void | Promise<void>;
  onDeleteForEveryone?: (notificationId: string) => void | Promise<void>;
  canDeleteForEveryone?: (notification: Notification) => boolean;
  formatTime: (date: string | number) => string;
}

export function EntityNotificationsView({
  entityId,
  entityType,
  isLoading,
  notifications = [],
  filteredNotifications = [],
  unreadNotifications = [],
  readNotifications = [],
  counts,
  unreadCount,
  searchQuery,
  labels,
  onSearchQueryChange,
  onMarkAllAsRead,
  onNotificationClick,
  onMarkAsRead,
  onToggleRead,
  onDismissNotification,
  onDeleteForEveryone,
  canDeleteForEveryone,
  formatTime,
}: EntityNotificationsViewProps) {
  const allCount = counts?.all ?? notifications.length;
  const filteredUnreadCount = counts?.unread ?? unreadNotifications.length;
  const totalUnreadCount = unreadCount ?? unreadNotifications.length;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" className="w-full">
        <header className="sr-only">
          <h2>{labels.title}</h2>
          <p>{labels.statusDescription}</p>
        </header>

        <div className="mb-4">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            placeholder={labels.searchPlaceholder}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-initial">
            <ScrollableTabsList className="w-fit max-w-full">
              <TabsTrigger value="all">
                {labels.all}
                <BadgeControl variant="secondary" className="ml-2">
                  {allCount}
                </BadgeControl>
              </TabsTrigger>
              <TabsTrigger value="unread">
                {labels.unread}
                {filteredUnreadCount > 0 ? (
                  <BadgeControl variant="default" className="ml-2">
                    {filteredUnreadCount}
                  </BadgeControl>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="read">{labels.read}</TabsTrigger>
            </ScrollableTabsList>
          </div>
          {totalUnreadCount > 0 ? (
            <Button className="shrink-0" onClick={onMarkAllAsRead} variant="outline">
              <CheckCheck className="mr-2 h-4 w-4" />
              {labels.markAllRead}
            </Button>
          ) : null}
        </div>

        <TabsContent value="all" className="mt-6">
          <NotificationsList
            notifications={filteredNotifications}
            virtualQuery={{
              key: `${entityType}-${entityId}-all`,
              tab: 'all',
              searchQuery,
              entityId,
              entityType,
            }}
            isLoading={isLoading}
            emptyIcon={Bell}
            emptyTitle={labels.noNotificationsYet}
            emptyDescription={labels.notificationsWillShowHere}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDismissNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
            formatTime={formatTime}
            mode="entity"
          />
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <NotificationsList
            notifications={unreadNotifications}
            virtualQuery={{
              key: `${entityType}-${entityId}-unread`,
              tab: 'unread',
              searchQuery,
              entityId,
              entityType,
            }}
            isLoading={isLoading}
            emptyIcon={Check}
            emptyTitle={labels.allCaughtUp}
            emptyDescription={labels.allRead}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDismissNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
            formatTime={formatTime}
            mode="entity"
          />
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <NotificationsList
            notifications={readNotifications}
            virtualQuery={{
              key: `${entityType}-${entityId}-read`,
              tab: 'read',
              searchQuery,
              entityId,
              entityType,
            }}
            isLoading={isLoading}
            emptyIcon={Bell}
            emptyTitle={labels.noReadNotifications}
            emptyDescription={labels.readNotificationsAppearHere}
            onNotificationClick={onNotificationClick}
            onMarkAsRead={onMarkAsRead}
            onToggleRead={onToggleRead}
            onDeleteNotification={onDismissNotification}
            onDeleteForEveryone={onDeleteForEveryone}
            canDeleteForEveryone={canDeleteForEveryone}
            formatTime={formatTime}
            mode="entity"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
