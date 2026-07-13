import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useNotificationActions } from './useNotificationActions';
import { useNotificationActions as useZeroNotificationActions } from '@/zero/notifications/useNotificationActions';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { queries } from '@/zero/queries';

export type NotificationTab = 'all' | 'unread' | 'read' | 'personal' | 'entity';
const NOTIFICATION_TAB_ORDER: NotificationTab[] = ['all', 'unread', 'read', 'personal', 'entity'];

export function useNotificationsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<NotificationTab>('all');

  const { markRead, markEntityNotificationRead } = useZeroNotificationActions();
  const { handleNotificationClick, handleDeleteNotification } = useNotificationActions();

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
  const [allUnreadRows, allUnreadResult] = useQuery(
    queries.notifications.countRows({ tab: 'unread', query: '' })
  );

  const counts = useMemo(
    () => ({
      all: allRows?.length ?? 0,
      unread: unreadRows?.length ?? 0,
      personal: personalRows?.length ?? 0,
      entity: entityRows?.length ?? 0,
    }),
    [allRows?.length, entityRows?.length, personalRows?.length, unreadRows?.length]
  );
  const unreadCount = allUnreadRows?.length ?? 0;

  const handleMarkAllAsRead = useCallback(async () => {
    for (const notification of allUnreadRows ?? []) {
      if (notification.recipient_entity_id && notification.recipient_entity_type) {
        await waitForClientApply(
          markEntityNotificationRead({
            id: crypto.randomUUID(),
            notification_id: notification.id,
            entity_id: notification.recipient_entity_id,
            entity_type: notification.recipient_entity_type,
          })
        );
      } else {
        await waitForClientApply(markRead({ id: notification.id }));
      }
    }
  }, [allUnreadRows, markEntityNotificationRead, markRead]);

  const isInitialLoading = [
    allResult,
    unreadResult,
    personalResult,
    entityResult,
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
    handleNotificationClick,
    handleDeleteNotification,
  };
}
