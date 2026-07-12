import { Button } from '@/features/shared/ui/ui/button';
import { CheckCheck } from 'lucide-react';
import { PushNotificationToggle } from '@/features/notifications/ui/push-notification-toggle.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface NotificationHeaderProps {
  unreadCount: number;
  onMarkAllAsRead: () => void;
}

export function NotificationHeader({ unreadCount, onMarkAllAsRead }: NotificationHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="sr-only">{t('features.notifications.titleVersion')}</h1>
      <div className="flex shrink-0 items-center gap-2">
        <PushNotificationToggle variant="minimal" />
        {unreadCount > 0 && (
          <Button onClick={onMarkAllAsRead} variant="outline">
            <CheckCheck className="mr-2 h-4 w-4" />
            {t('features.notifications.markAllAsRead')}
          </Button>
        )}
      </div>
    </>
  );
}
