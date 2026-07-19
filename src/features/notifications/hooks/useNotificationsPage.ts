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

export function useNotificationsPage() {
  const { t } = useTranslation();
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

  const [allRows, allResult] = useQuery(
    queries.notifications.countRows({ tab: 'all', query: searchQuery })
  );
  const [unreadRows, unreadResult] = useQuery(
    queries.notifications.countRows({ tab: 'unread', query: searchQuery })
  );
  const [personalRows, personalResult] = useQuery(
    queries.notifications.countRows({ tab: 'personal', query: searchQuery })
  );
  const [entityRows, entityResult] = useQuery(
    queries.notifications.countRows({ tab: 'entity', query: searchQuery })
  );
  const [trashRows, trashResult] = useQuery(
    queries.notifications.countRows({ tab: 'trash', query: searchQuery })
  );
  const [allUnreadRows, allUnreadResult] = useQuery(
    queries.notifications.countRows({ tab: 'unread', query: '' })
  );

  const counts = calculateNotificationCounts({
    all: allRows ?? [],
    unread: unreadRows ?? [],
    personal: personalRows ?? [],
    entity: entityRows ?? [],
    trash: trashRows ?? [],
  });
  const unreadCount = (allUnreadRows ?? []).filter(
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

  const isInitialLoading = [
    allResult,
    unreadResult,
    personalResult,
    entityResult,
    trashResult,
    allUnreadResult,
  ].some(result => result.type === 'unknown');
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
