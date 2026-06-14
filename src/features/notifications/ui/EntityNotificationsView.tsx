import { Bell, Check, CheckCheck } from 'lucide-react';

import { LoadingState } from '@/features/shared/ui/feedback';
import { BadgeControl } from '@/features/shared/ui/status';
import { LinkSurface } from '@/features/shared/ui/navigation/LinkSurface.tsx';
import { SmartLink, isPlainLeftClick } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { EntitySearchBar } from '@/features/shared/ui/typeahead/EntitySearchBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { ScrollableTabsList } from '@/features/shared/ui/navigation/ScrollableTabs';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs.tsx';
import { getNotificationNavigationHref } from '@/features/notifications/logic/notificationHelpers.ts';
import type {
  Notification,
  NotificationType,
} from '@/features/notifications/types/notification.types.ts';
import {
  getNotificationColor,
  getNotificationIcon,
} from '@/features/notifications/utils/notificationConstants.ts';
import { cn } from '@/features/shared/utils/utils.ts';

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

function getUserName(user: Notification['sender']) {
  if (!user) return null;
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || null;
}

interface EntityNotificationItemProps {
  notification: Notification;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  formatTime: (date: string | number) => string;
}

function EntityNotificationItem({
  notification,
  onNotificationClick,
  formatTime,
}: EntityNotificationItemProps) {
  const Icon = getNotificationIcon(notification.type as NotificationType);
  const iconColor = getNotificationColor(notification.type as NotificationType);
  const senderName = getUserName(notification.sender);
  const receiverName = getUserName(notification.related_user);
  const notificationHref = getNotificationNavigationHref(notification);
  const cardContent = (
    <CardContent className="flex items-start gap-3 p-3">
      <div
        className={cn(
          'bg-muted mt-0.5 rounded-full p-1.5',
          !notification.is_read && 'bg-primary/10'
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        {(notification.sender || notification.related_user) && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {notification.sender ? (
              <>
                {notification.sender.id ? (
                  <SmartLink href={`/user/${notification.sender.id}`} className="shrink-0">
                    <Avatar className="hover:ring-primary h-5 w-5 hover:ring-1">
                      <AvatarImage src={notification.sender?.avatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {senderName?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </SmartLink>
                ) : (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={notification.sender?.avatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {senderName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
                {notification.sender.id ? (
                  <SmartLink
                    href={`/user/${notification.sender.id}`}
                    className="hover:text-primary truncate font-medium hover:underline"
                  >
                    {senderName}
                  </SmartLink>
                ) : (
                  <span className="truncate font-medium">{senderName}</span>
                )}
              </>
            ) : null}
            {notification.sender && notification.related_user ? (
              <span className="shrink-0">→</span>
            ) : null}
            {notification.related_user ? (
              <>
                {notification.related_user.id ? (
                  <SmartLink
                    href={`/user/${notification.related_user.id}`}
                    className="hover:text-primary truncate font-medium hover:underline"
                  >
                    {receiverName}
                  </SmartLink>
                ) : (
                  <span className="truncate font-medium">{receiverName}</span>
                )}
                {notification.related_user.id ? (
                  <SmartLink href={`/user/${notification.related_user.id}`} className="shrink-0">
                    <Avatar className="hover:ring-primary h-5 w-5 hover:ring-1">
                      <AvatarImage src={notification.related_user?.avatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {receiverName?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </SmartLink>
                ) : (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={notification.related_user?.avatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {receiverName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </>
            ) : null}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', !notification.is_read && 'font-semibold')}>
            {notification.title}
          </p>
          {!notification.is_read ? (
            <BadgeControl variant="default" className="h-2 w-2 rounded-full p-0" />
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{notification.message}</p>
        <p className="text-muted-foreground text-xs">{formatTime(notification.created_at)}</p>
      </div>
    </CardContent>
  );
  const cardClassName = cn(
    'cursor-pointer transition-all hover:shadow-md',
    !notification.is_read && 'border-l-primary bg-accent/50 border-l-4'
  );

  if (notificationHref) {
    return (
      <Card className={cardClassName}>
        <LinkSurface
          href={notificationHref}
          mode="overlay"
          label={notification.title ?? 'Notification'}
          onClick={event => {
            if (!isPlainLeftClick(event)) {
              return;
            }

            event.preventDefault();
            void onNotificationClick(notification);
          }}
        >
          {cardContent}
        </LinkSurface>
      </Card>
    );
  }

  return (
    <Card className={cardClassName} onClick={() => onNotificationClick(notification)}>
      {cardContent}
    </Card>
  );
}

function EntityNotificationList({
  notifications,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  onNotificationClick,
  formatTime,
}: {
  notifications: Notification[];
  emptyIcon: typeof Bell;
  emptyTitle: string;
  emptyDescription: string;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  formatTime: (date: string | number) => string;
}) {
  const EmptyIcon = emptyIcon;

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <EmptyIcon className="text-muted-foreground mb-4 h-12 w-12" />
          <p className="text-lg font-semibold">{emptyTitle}</p>
          <p className="text-muted-foreground text-sm">{emptyDescription}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map(notification => (
        <EntityNotificationItem
          key={notification.id}
          notification={notification}
          onNotificationClick={onNotificationClick}
          formatTime={formatTime}
        />
      ))}
    </div>
  );
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
  if (isLoading) {
    return <LoadingState label={labels.loading} className="h-[400px]" />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" className="w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{labels.title}</h2>
            <p className="text-muted-foreground">{labels.statusDescription}</p>
          </div>
          {unreadNotifications.length > 0 ? (
            <Button onClick={onMarkAllAsRead} variant="outline">
              <CheckCheck className="mr-2 h-4 w-4" />
              {labels.markAllRead}
            </Button>
          ) : null}
        </div>

        <div className="mb-4">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            placeholder={labels.searchPlaceholder}
          />
        </div>

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

        <TabsContent value="all" className="mt-6">
          <EntityNotificationList
            notifications={filteredNotifications}
            emptyIcon={Bell}
            emptyTitle={labels.noNotificationsYet}
            emptyDescription={labels.notificationsWillShowHere}
            onNotificationClick={onNotificationClick}
            formatTime={formatTime}
          />
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <EntityNotificationList
            notifications={unreadNotifications}
            emptyIcon={Check}
            emptyTitle={labels.allCaughtUp}
            emptyDescription={labels.allRead}
            onNotificationClick={onNotificationClick}
            formatTime={formatTime}
          />
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <EntityNotificationList
            notifications={readNotifications}
            emptyIcon={Bell}
            emptyTitle={labels.noReadNotifications}
            emptyDescription={labels.readNotificationsAppearHere}
            onNotificationClick={onNotificationClick}
            formatTime={formatTime}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
