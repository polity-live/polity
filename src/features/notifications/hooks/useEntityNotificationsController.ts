import { useCallback, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@rocicorp/zero/react';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import {
  getNotificationNavigationTarget,
  isNotificationRead,
} from '@/features/notifications/logic/notificationHelpers.ts';
import type { Notification } from '@/features/notifications/types/notification.types.ts';
import type { EntityType } from '@/features/notifications/utils/notification-helpers.ts';
import { useNotificationActions as useZeroNotificationActions } from '@/zero/notifications/useNotificationActions.ts';
import { queries } from '@/zero/queries';
import { useNotificationActions } from './useNotificationActions';
import { isNotificationActive } from '@/zero/notifications/notificationReadState';
import { usePermissionEvaluator } from '@/zero/rbac';
import { canManageEntityNotification } from '../logic/notificationPermissions';

interface UseEntityNotificationsControllerOptions {
  entityId: string;
  entityType: EntityType;
  entityName: string;
}

export function useEntityNotificationsController({
  entityId,
  entityType,
  entityName,
}: UseEntityNotificationsControllerOptions) {
  const { t } = useTranslation();
  const permissionEvaluator = usePermissionEvaluator();
  const navigate = useNavigate();
  const { setAllNotificationsRead } = useZeroNotificationActions();
  const {
    handleMarkNotificationAsRead,
    handleToggleNotificationRead,
    handleDismissNotification,
    handleDeleteEntityNotificationGlobally,
  } = useNotificationActions();
  const [searchQuery, setSearchQuery] = useState('');

  const countArgs = { entityId, entityType };
  const [allRows, allResult] = useQuery(
    queries.notifications.countRows({
      ...countArgs,
      tab: 'all',
      query: searchQuery,
    })
  );
  const [unreadRows, unreadResult] = useQuery(
    queries.notifications.countRows({
      ...countArgs,
      tab: 'unread',
      query: searchQuery,
    })
  );
  const [allUnreadRows, allUnreadResult] = useQuery(
    queries.notifications.countRows({
      ...countArgs,
      tab: 'unread',
      query: '',
    })
  );
  const counts = {
    all: (allRows ?? []).filter(isNotificationActive).length,
    unread: (unreadRows ?? []).filter(
      notification => isNotificationActive(notification) && !isNotificationRead(notification)
    ).length,
  };
  const unreadCount = (allUnreadRows ?? []).filter(
    notification => isNotificationActive(notification) && !isNotificationRead(notification)
  ).length;
  const canDeleteForEveryone = useCallback(
    (notification: Notification) => canManageEntityNotification(notification, permissionEvaluator),
    [permissionEvaluator]
  );
  const isLoading = [allResult, unreadResult, allUnreadResult].some(
    result => result.type === 'unknown'
  );

  const handleNotificationClick = async (notification: Notification) => {
    if (!isNotificationRead(notification)) {
      await handleMarkNotificationAsRead(notification);
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
    if (unreadCount > 0) {
      setAllNotificationsRead({
        scope: {
          kind: 'entity',
          entityId,
          entityType: entityType as 'group' | 'event' | 'amendment' | 'blog',
        },
        read: true,
      });
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
    counts.unread > 0
      ? counts.unread === 1
        ? t('pages.notifications.entity.unreadCount', {
            count: counts.unread,
          })
        : t('pages.notifications.entity.unreadCountPlural', {
            count: counts.unread,
          })
      : t('pages.notifications.entity.allCaughtUp');

  return {
    isLoading,
    counts,
    unreadCount,
    searchQuery,
    labels: {
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
    },
    onSearchQueryChange: setSearchQuery,
    onMarkAllAsRead: markAllAsRead,
    onNotificationClick: handleNotificationClick,
    onMarkAsRead: handleMarkNotificationAsRead,
    onToggleRead: handleToggleNotificationRead,
    onDismissNotification: handleDismissNotification,
    onDeleteForEveryone: handleDeleteEntityNotificationGlobally,
    canDeleteForEveryone,
    formatTime,
  };
}
