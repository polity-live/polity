import { useNotificationsPage } from './hooks/useNotificationsPage';
import { NotificationsPageView } from './ui/NotificationsPageView';

export function NotificationsPage() {
  const np = useNotificationsPage();

  return (
    <NotificationsPageView
      searchQuery={np.searchQuery}
      onSearchQueryChange={np.setSearchQuery}
      selectedTab={np.selectedTab}
      onSelectedTabChange={np.setSelectedTab}
      tabSwipeHandlers={np.tabSwipeHandlers}
      unreadCount={np.unreadCount}
      counts={np.counts}
      isInitialLoading={np.isInitialLoading}
      labels={{
        searchPlaceholder: np.t('features.notifications.searchPlaceholder'),
        emptyAllTitle: np.t('features.notifications.empty.noNotificationsYet'),
        emptyAllDescription: np.t('features.notifications.empty.whenYouGet'),
        allCaughtUpTitle: np.t('features.notifications.allCaughtUp'),
        emptyUnreadDescription: np.t('features.notifications.empty.allRead'),
        emptyReadTitle: np.t('features.notifications.empty.noRead'),
        emptyReadDescription: np.t('features.notifications.empty.readAppear'),
        emptyPersonalTitle: np.t('features.notifications.empty.noPersonal'),
        emptyPersonalDescription: np.t('features.notifications.empty.personalAppear'),
        emptyEntityTitle: np.t('features.notifications.empty.noEntity'),
        emptyEntityDescription: np.t('features.notifications.empty.entityAppear'),
      }}
      onMarkAllAsRead={np.handleMarkAllAsRead}
      onNotificationClick={np.handleNotificationClick}
      onDeleteNotification={np.handleDeleteNotification}
    />
  );
}
