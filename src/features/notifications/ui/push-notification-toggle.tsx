'use client';

import { usePushSubscription } from '@/features/pwa/hooks/usePushSubscription.ts';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';

interface PushNotificationToggleProps {
  variant?: 'default' | 'card' | 'minimal';
  showDescription?: boolean;
}
import { PushNotificationToggleView } from './PushNotificationToggleView';
export function PushNotificationToggle({
  variant = 'default',
  showDescription = true,
}: PushNotificationToggleProps) {
  const { t } = useTranslation();
  const { isSupported, isSubscribed, isLoading, permission, error, subscribe, unsubscribe } =
    usePushSubscription();

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast.success(t('components.pushNotifications.deactivated'));
      } else {
        await subscribe();
        // Only show success if subscribe didn't throw
        toast.success(t('components.pushNotifications.activated'));
      }
    } catch (err: unknown) {
      console.error('[PushNotificationToggle] Error:', err);
      toast.error(err instanceof Error ? err.message : t('components.pushNotifications.error'));
    }
  };
  return (
    <PushNotificationToggleView
      variant={variant}
      showDescription={showDescription}
      t={t}
      isSupported={isSupported}
      isSubscribed={isSubscribed}
      isLoading={isLoading}
      permission={permission}
      error={error}
      subscribe={subscribe}
      unsubscribe={unsubscribe}
      handleToggle={handleToggle}
    />
  );
}
