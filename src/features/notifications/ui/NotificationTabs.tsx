import { BadgeControl } from '@/features/shared/ui/status';
import { TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface NotificationTabsProps {
  allCount: number;
  unreadCount: number;
  personalCount: number;
  entityCount: number;
  trashCount: number;
}

export function NotificationTabs({
  allCount,
  unreadCount,
  personalCount,
  entityCount,
  trashCount,
}: NotificationTabsProps) {
  const { t } = useTranslation();

  return (
    <ScrollableTabsList className="w-fit max-w-full">
      <TabsTrigger value="all">
        {t('features.notifications.filters.all')}
        <BadgeControl variant="secondary" className="ml-2">
          {allCount}
        </BadgeControl>
      </TabsTrigger>
      <TabsTrigger value="unread">
        {t('features.notifications.filters.unread')}
        {unreadCount > 0 && (
          <BadgeControl variant="default" className="ml-2">
            {unreadCount}
          </BadgeControl>
        )}
      </TabsTrigger>
      <TabsTrigger value="read">{t('features.notifications.filters.read')}</TabsTrigger>
      <TabsTrigger value="personal">
        {t('features.notifications.filters.personal')}
        <BadgeControl variant="secondary" className="ml-2">
          {personalCount}
        </BadgeControl>
      </TabsTrigger>
      <TabsTrigger value="entity">
        {t('features.notifications.filters.entity')}
        <BadgeControl variant="secondary" className="ml-2">
          {entityCount}
        </BadgeControl>
      </TabsTrigger>
      <TabsTrigger value="trash">
        {t('features.notifications.filters.trash')}
        {trashCount > 0 ? (
          <BadgeControl variant="secondary" className="ml-2">
            {trashCount}
          </BadgeControl>
        ) : null}
      </TabsTrigger>
    </ScrollableTabsList>
  );
}
