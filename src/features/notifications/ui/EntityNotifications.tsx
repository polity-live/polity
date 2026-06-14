'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { useNotificationActions } from '@/zero/notifications/useNotificationActions.ts';
import { useNotificationState } from '@/zero/notifications/useNotificationState.ts';
import type { EntityType } from '@/features/notifications/utils/notification-helpers.ts';
import { getNotificationNavigationTarget } from '@/features/notifications/logic/notificationHelpers.ts';
import type { Notification } from '@/features/notifications/types/notification.types.ts';
import { EntityNotificationsView } from './EntityNotificationsView';

interface EntityNotificationsProps {
  entityId: string;
  entityType: EntityType;
  entityName: string;
}

export function EntityNotifications({
  entityId,
  entityType,
  entityName,
}: EntityNotificationsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { markEntityNotificationRead, markAllEntityNotificationsRead } = useNotificationActions();
  const { entityNotifications: notifications, isLoading } = useNotificationState({
    entityFilter: { entityId, entityType },
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (entityId && entityType && notifications.length > 0) {
      markAllEntityNotificationsRead({ entity_id: entityId, entity_type: entityType });
    }
  }, [entityId, entityType, notifications.length, markAllEntityNotificationsRead]);

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;

    const query = searchQuery.toLowerCase();
    return notifications.filter(notification => {
      const senderName = [notification.sender?.first_name, notification.sender?.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const title = (notification.title || '').toLowerCase();
      const message = (notification.message || '').toLowerCase();

      return senderName.includes(query) || title.includes(query) || message.includes(query);
    });
  }, [notifications, searchQuery]);

  const unreadNotifications = filteredNotifications.filter(notification => !notification.is_read);
  const readNotifications = filteredNotifications.filter(notification => notification.is_read);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      markEntityNotificationRead({
        id: crypto.randomUUID(),
        notification_id: notification.id,
        entity_id: entityId,
        entity_type: entityType,
      });
    }

    const navigationTarget = getNotificationNavigationTarget(notification);

    if (navigationTarget?.kind === 'messages') {
      navigate({
        to: '/messages',
        search: navigationTarget.search,
      });
      return;
    }

    if (navigationTarget?.kind === 'route') {
      navigate({ to: navigationTarget.to });
      return;
    }

    if (notification.related_user_id) {
      navigate({ to: `/user/${notification.related_user_id}` });
    }
  };

  const markAllAsRead = async () => {
    if (unreadNotifications.length > 0) {
      await markAllEntityNotificationsRead({ entity_id: entityId, entity_type: entityType });
    }
  };

  const formatTime = (date: string | number) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInHours = (now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return t('pages.notifications.time.minutesAgo', {
        count: Math.floor(diffInHours * 60),
      });
    }

    if (diffInHours < 24) {
      return t('pages.notifications.time.hoursAgo', { count: Math.floor(diffInHours) });
    }

    if (diffInHours < 168) {
      return t('pages.notifications.time.daysAgo', { count: Math.floor(diffInHours / 24) });
    }

    return notificationDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const statusDescription =
    unreadNotifications.length > 0
      ? unreadNotifications.length === 1
        ? t('pages.notifications.entity.unreadCount', {
            count: unreadNotifications.length,
          })
        : t('pages.notifications.entity.unreadCountPlural', {
            count: unreadNotifications.length,
          })
      : t('pages.notifications.entity.allCaughtUp');

  return (
    <EntityNotificationsView
      isLoading={isLoading}
      notifications={notifications}
      filteredNotifications={filteredNotifications}
      unreadNotifications={unreadNotifications}
      readNotifications={readNotifications}
      searchQuery={searchQuery}
      labels={{
        loading: t('pages.notifications.entity.loadingNotifications'),
        title: t('pages.notifications.entity.title', { entityName }),
        statusDescription,
        markAllRead: t('pages.notifications.markAllRead'),
        searchPlaceholder: t('features.notifications.searchPlaceholder'),
        all: t('pages.notifications.filters.all'),
        unread: t('pages.notifications.filters.unread'),
        read: t('pages.notifications.filters.read'),
        noNotificationsYet: t('pages.notifications.entity.noNotificationsYet'),
        notificationsWillShowHere: t('pages.notifications.entity.notificationsWillShowHere', {
          entityType,
        }),
        allCaughtUp: t('pages.notifications.entity.allCaughtUp'),
        allRead: t('pages.notifications.entity.allRead'),
        noReadNotifications: t('pages.notifications.entity.noReadNotifications'),
        readNotificationsAppearHere: t('pages.notifications.entity.readNotificationsAppearHere'),
      }}
      onSearchQueryChange={setSearchQuery}
      onMarkAllAsRead={markAllAsRead}
      onNotificationClick={handleNotificationClick}
      formatTime={formatTime}
    />
  );
}
