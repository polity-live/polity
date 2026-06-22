import { useState, useMemo, useCallback } from 'react';
import { useInfiniteScroll } from '@/features/shared/hooks/useInfiniteScroll';
import { useNotificationFilters } from './useNotificationFilters';
import { useNotificationActions } from './useNotificationActions';
import { useUserNotifications } from './useUserNotifications';
import { useNotificationActions as useZeroNotificationActions } from '@/zero/notifications/useNotificationActions';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { Notification } from '../types/notification.types';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';

const EMPTY_NOTIFICATIONS: Notification[] = [];
const PAGE_SIZE = 30;
export type NotificationTab = 'all' | 'unread' | 'read' | 'personal' | 'entity';
const NOTIFICATION_TAB_ORDER: NotificationTab[] = ['all', 'unread', 'read', 'personal', 'entity'];

export function useNotificationsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedTab, setSelectedTab] = useState<NotificationTab>('all');

  const { data, isLoading, userId } = useUserNotifications();
  const { markRead, markEntityNotificationRead } = useZeroNotificationActions();

  const notifications = useMemo(
    () => data?.notifications ?? EMPTY_NOTIFICATIONS,
    [data?.notifications]
  );

  const filteredNotifications = useNotificationFilters({ notifications, userId });
  const { handleNotificationClick, handleDeleteNotification } = useNotificationActions();

  const handleMarkAllAsRead = useCallback(async () => {
    for (const notification of filteredNotifications.unread) {
      if (notification.recipient_entity_id && notification.recipient_entity_type) {
        await markEntityNotificationRead({
          id: crypto.randomUUID(),
          notification_id: notification.id,
          entity_id: notification.recipient_entity_id,
          entity_type: notification.recipient_entity_type,
        });
      } else {
        await markRead({ id: notification.id });
      }
    }
  }, [filteredNotifications.unread, markEntityNotificationRead, markRead]);

  // Filter notifications based on search query
  const searchFilteredNotifications = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch = (n: Notification) =>
      !searchQuery ||
      n.title?.toLowerCase().includes(lowerQuery) ||
      n.message?.toLowerCase().includes(lowerQuery);

    return {
      all: filteredNotifications.all.filter(matchesSearch),
      unread: filteredNotifications.unread.filter(matchesSearch),
      read: filteredNotifications.read.filter(matchesSearch),
      personal: filteredNotifications.personal.filter(matchesSearch),
      entity: filteredNotifications.entity.filter(matchesSearch),
    };
  }, [filteredNotifications, searchQuery]);

  // Client-side pagination
  const paginatedNotifications = useMemo(
    () => ({
      all: searchFilteredNotifications.all.slice(0, visibleCount),
      unread: searchFilteredNotifications.unread.slice(0, visibleCount),
      read: searchFilteredNotifications.read.slice(0, visibleCount),
      personal: searchFilteredNotifications.personal.slice(0, visibleCount),
      entity: searchFilteredNotifications.entity.slice(0, visibleCount),
    }),
    [searchFilteredNotifications, visibleCount]
  );

  const hasMore = searchFilteredNotifications.all.length > visibleCount;

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading: false,
    onLoadMore: handleLoadMore,
  });

  const isInitialLoading = isLoading && notifications.length === 0;
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
    filteredNotifications,
    searchFilteredNotifications,
    paginatedNotifications,
    isInitialLoading,
    hasMore,
    loadMoreRef,
    handleMarkAllAsRead,
    handleNotificationClick,
    handleDeleteNotification,
  };
}
