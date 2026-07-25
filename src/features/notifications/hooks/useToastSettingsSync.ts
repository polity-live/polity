import { useEffect } from 'react';
import { useNotificationSettingsState } from '@/zero/notifications/useNotificationSettingsState';
import { setInAppNotificationsEnabled } from '@/features/notifications/utils/gated-toast';

/**
 * Syncs the user's delivery settings into the gated-toast module cache.
 * Should be called once in AuthenticatedShell so the cache stays up to date.
 */
export function useToastSettingsSync() {
  const { data: settings } = useNotificationSettingsState();

  useEffect(() => {
    if (!settings?.delivery_settings) {
      // Defaults: all enabled
      setInAppNotificationsEnabled(true);
      return;
    }

    const deliverySettings = settings.delivery_settings as Record<string, boolean>;
    setInAppNotificationsEnabled(deliverySettings?.inAppNotifications !== false);
  }, [settings?.delivery_settings]);
}
