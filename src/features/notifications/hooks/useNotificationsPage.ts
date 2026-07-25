import { useState, useCallback } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useNotificationActions } from './useNotificationActions';
import { useNotificationActions as useZeroNotificationActions } from '@/zero/notifications/useNotificationActions';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';
import { queries } from '@/zero/queries';
import {
  isNotificationActive,
  isNotificationDismissed,
  isNotificationPurged,
  isNotificationRead,
  type ReadableNotification,
} from '@/zero/notifications/notificationReadState';
import { usePermissionEvaluator } from '@/zero/rbac';
import { canManageEntityNotification } from '../logic/notificationPermissions';
import { useAuth } from '@/providers/auth-provider';
import type { NotificationCountProjectionRow } from '@/zero/notifications/queries';

export type NotificationTab = 'all' | 'unread' | 'read' | 'personal' | 'entity' | 'trash';
const NOTIFICATION_TAB_ORDER: NotificationTab[] = [
  'all',
  'unread',
  'read',
  'personal',
  'entity',
  'trash',
];

interface NotificationCountRows {
  all: readonly ReadableNotification[];
  unread: readonly ReadableNotification[];
  personal: readonly ReadableNotification[];
  entity: readonly ReadableNotification[];
  trash: readonly ReadableNotification[];
}

export function calculateNotificationCounts(rows: NotificationCountRows) {
  return {
    all: rows.all.filter(isNotificationActive).length,
    unread: rows.unread.filter(row => isNotificationActive(row) && !isNotificationRead(row)).length,
    personal: rows.personal.filter(row => isNotificationActive(row) && !isNotificationRead(row))
      .length,
    entity: rows.entity.filter(row => isNotificationActive(row) && !isNotificationRead(row)).length,
    trash: rows.trash.filter(row => isNotificationDismissed(row) && !isNotificationPurged(row))
      .length,
  };
}

const ENTITY_RECIPIENT_TYPES = new Set(['group', 'event', 'amendment', 'blog']);

export function calculateNotificationCountsFromProjection(
  rows: readonly NotificationCountProjectionRow[],
  userID: string | undefined
) {
  const activeRows = rows.filter(isNotificationActive);
  const unreadRows = activeRows.filter(row => !isNotificationRead(row));
  return {
    all: activeRows.length,
    unread: unreadRows.length,
    personal: unreadRows.filter(row => row.recipient_id === userID).length,
    entity: unreadRows.filter(row => ENTITY_RECIPIENT_TYPES.has(row.recipient_entity_type ?? ''))
      .length,
    trash: rows.filter(row => isNotificationDismissed(row) && !isNotificationPurged(row)).length,
  };
}

export function useNotificationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<NotificationTab>('all');
  const permissionEvaluator = usePermissionEvaluator();

  const { setAllNotificationsRead } = useZeroNotificationActions();
  const {
    handleNotificationClick,
    handleMarkNotificationAsRead,
    handleToggleNotificationRead,
    handleDismissNotification,
    handleRestoreNotification,
    handlePurgeNotification,
    handleDeleteEntityNotificationGlobally,
  } = useNotificationActions();

  const normalizedSearchQuery = searchQuery.trim();
  const [countRows, countResult] = useQuery(
    queries.notifications.countProjection({
      query: normalizedSearchQuery,
      entityId: null,
      entityType: null,
    })
  );
  const [allUnreadRows, allUnreadResult] = useQuery(
    normalizedSearchQuery
      ? queries.notifications.countProjection({
          query: '',
          entityId: null,
          entityType: null,
        })
      : undefined
  );

  const counts = calculateNotificationCountsFromProjection(countRows ?? [], user?.id);
  const unreadCountRows = normalizedSearchQuery ? (allUnreadRows ?? []) : (countRows ?? []);
  const unreadCount = unreadCountRows.filter(
    row => isNotificationActive(row) && !isNotificationRead(row)
  ).length;
  const canDeleteForEveryone = useCallback(
    (notification: Parameters<typeof canManageEntityNotification>[0]) =>
      canManageEntityNotification(notification, permissionEvaluator),
    [permissionEvaluator]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    setAllNotificationsRead({ scope: { kind: 'inbox' }, read: true });
  }, [setAllNotificationsRead]);

  const handleMarkAllAsUnread = useCallback(async () => {
    setAllNotificationsRead({ scope: { kind: 'inbox' }, read: false });
  }, [setAllNotificationsRead]);

  const isInitialLoading =
    countResult.type === 'unknown' ||
    (normalizedSearchQuery.length > 0 && allUnreadResult.type === 'unknown');
  const selectedTabIndex = NOTIFICATION_TAB_ORDER.indexOf(selectedTab);
  const { handlers: tabSwipeHandlers } = useSwipeNavigation({
    canSwipePrev: selectedTabIndex > 0,
    canSwipeNext: selectedTabIndex >= 0 && selectedTabIndex < NOTIFICATION_TAB_ORDER.length - 1,
    onSwipePrev: () => {
      const previousTab = NOTIFICATION_TAB_ORDER[selectedTabIndex - 1];
      if (previousTab) {
        setSelectedTab(previousTab);
      }
    },
    onSwipeNext: () => {
      const nextTab = NOTIFICATION_TAB_ORDER[selectedTabIndex + 1];
      if (nextTab) {
        setSelectedTab(nextTab);
      }
    },
    keyboardMode: 'global',
  });

  return {
    t,
    searchQuery,
    setSearchQuery,
    selectedTab,
    setSelectedTab,
    tabSwipeHandlers,
    counts,
    unreadCount,
    isInitialLoading,
    handleMarkAllAsRead,
    handleMarkAllAsUnread,
    handleNotificationClick,
    handleMarkNotificationAsRead,
    handleToggleNotificationRead,
    handleDismissNotification,
    handleRestoreNotification,
    handlePurgeNotification,
    handleDeleteEntityNotificationGlobally,
    canDeleteForEveryone,
  };
}
