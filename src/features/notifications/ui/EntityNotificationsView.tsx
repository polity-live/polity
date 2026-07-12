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
  isLoading: boolean;
  notifications: Notification[];
  filteredNotifications: Notification[];
  unreadNotifications: Notification[];
  readNotifications: Notification[];
  searchQuery: string;
  labels: EntityNotificationsViewLabels;
  onSearchQueryChange: (query: string) => void;
  onMarkAllAsRead: () => void | Promise<void>;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  formatTime: (date: string | number) => string;
}

export function EntityNotificationsView({
  isLoading,
  notifications,
  filteredNotifications,
  unreadNotifications,
  readNotifications,
  searchQuery,
  labels,
  onSearchQueryChange,
  onMarkAllAsRead,
  onNotificationClick,
  formatTime,
}: EntityNotificationsViewProps) {
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
          <div className="min-w-0 flex-1">
            <ScrollableTabsList>
              <TabsTrigger value="all">
                {labels.all}
                <BadgeControl variant="secondary" className="ml-2">
                  {notifications.length}
                </BadgeControl>
              </TabsTrigger>
              <TabsTrigger value="unread">
                {labels.unread}
                {unreadNotifications.length > 0 ? (
                  <BadgeControl variant="default" className="ml-2">
                    {unreadNotifications.length}
                  </BadgeControl>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="read">{labels.read}</TabsTrigger>
            </ScrollableTabsList>
          </div>
          {unreadNotifications.length > 0 ? (
            <Button className="shrink-0" onClick={onMarkAllAsRead} variant="outline">
              <CheckCheck className="mr-2 h-4 w-4" />
              {labels.markAllRead}
            </Button>
          ) : null}
        </div>

        <TabsContent value="all" className="mt-6">
          <NotificationsList
            notifications={filteredNotifications}
            isLoading={isLoading}
            emptyIcon={Bell}
            emptyTitle={labels.noNotificationsYet}
            emptyDescription={labels.notificationsWillShowHere}
            onNotificationClick={onNotificationClick}
            formatTime={formatTime}
            mode="entity"
          />
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <NotificationsList
            notifications={unreadNotifications}
            isLoading={isLoading}
            emptyIcon={Check}
            emptyTitle={labels.allCaughtUp}
            emptyDescription={labels.allRead}
            onNotificationClick={onNotificationClick}
            formatTime={formatTime}
            mode="entity"
          />
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <NotificationsList
            notifications={readNotifications}
            isLoading={isLoading}
            emptyIcon={Bell}
            emptyTitle={labels.noReadNotifications}
            emptyDescription={labels.readNotificationsAppearHere}
            onNotificationClick={onNotificationClick}
            formatTime={formatTime}
            mode="entity"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
