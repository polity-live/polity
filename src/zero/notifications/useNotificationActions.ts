import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError, trackServerFinalization } from '../mutate-with-server-check';

/**
 * Action hook for notification mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useNotificationActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── Read Status ────────────────────────────────────────────────────
  const setNotificationRead = useCallback(
    (args: Parameters<typeof mutators.notifications.setNotificationRead>[0]) => {
      const result = zero.mutate(mutators.notifications.setNotificationRead(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.markReadFailed')));
      return result;
    },
    [zero, t]
  );

  const setAllNotificationsRead = useCallback(
    (args: Parameters<typeof mutators.notifications.setAllNotificationsRead>[0]) => {
      const result = zero.mutate(mutators.notifications.setAllNotificationsRead(args));
      trackServerFinalization(result, {
        onSuccess: () =>
          toast.success(
            t(
              args.read
                ? 'features.notifications.toasts.allMarkedRead'
                : 'features.notifications.toasts.allMarkedUnread'
            )
          ),
        onError: () => toast.error(t('features.notifications.toasts.markAllReadFailed')),
      });
      return result;
    },
    [zero, t]
  );

  const markRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markRead(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.markReadFailed')));
      return result;
    },
    [zero, t]
  );

  const markAllRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markAllRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markAllRead(args));
      trackServerFinalization(result, {
        onSuccess: () => toast.success(t('features.notifications.toasts.allMarkedRead')),
        onError: () => toast.error(t('features.notifications.toasts.markAllReadFailed')),
      });
      return result;
    },
    [zero, t]
  );

  // ── Delete ─────────────────────────────────────────────────────────
  const dismissNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.dismissNotification>[0]) => {
      const result = zero.mutate(mutators.notifications.dismissNotification(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.dismissFailed')));
      return result;
    },
    [zero, t]
  );

  const restoreNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.restoreNotification>[0]) => {
      const result = zero.mutate(mutators.notifications.restoreNotification(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.restoreFailed')));
      return result;
    },
    [zero, t]
  );

  const purgeNotificationForUser = useCallback(
    (args: Parameters<typeof mutators.notifications.purgeNotificationForUser>[0]) => {
      const result = zero.mutate(mutators.notifications.purgeNotificationForUser(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.purgeFailed')));
      return result;
    },
    [zero, t]
  );

  const deleteEntityNotificationGlobally = useCallback(
    (args: Parameters<typeof mutators.notifications.deleteEntityNotificationGlobally>[0]) => {
      const result = zero.mutate(mutators.notifications.deleteEntityNotificationGlobally(args));
      trackServerFinalization(result, {
        onSuccess: () => toast.success(t('features.notifications.toasts.deletedForEveryone')),
        onError: () => toast.error(t('features.notifications.toasts.globalDeleteFailed')),
      });
      return result;
    },
    [zero, t]
  );

  const restoreEntityNotificationGlobally = useCallback(
    (args: Parameters<typeof mutators.notifications.restoreEntityNotificationGlobally>[0]) => {
      const result = zero.mutate(mutators.notifications.restoreEntityNotificationGlobally(args));
      onServerError(result, () =>
        toast.error(t('features.notifications.toasts.globalRestoreFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const createEntityNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.createEntityNotification>[0]) => {
      const result = zero.mutate(mutators.notifications.createEntityNotification(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.createFailed')));
      return result;
    },
    [zero, t]
  );

  const updateEntityNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.updateEntityNotification>[0]) => {
      const result = zero.mutate(mutators.notifications.updateEntityNotification(args));
      onServerError(result, () =>
        toast.error(t('features.notifications.toasts.contentUpdateFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const deleteNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.delete>[0]) => {
      const result = zero.mutate(mutators.notifications.delete(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.deleteFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Settings ───────────────────────────────────────────────────────
  const updateSettings = useCallback(
    (args: Parameters<typeof mutators.notifications.updateSettings>[0]) => {
      const result = zero.mutate(mutators.notifications.updateSettings(args));
      toast.success(t('features.notifications.toasts.settingsUpdated'));
      onServerError(result, () =>
        toast.error(t('features.notifications.toasts.settingsUpdateFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const createSettings = useCallback(
    (args: Parameters<typeof mutators.notifications.createSettings>[0]) => {
      const result = zero.mutate(mutators.notifications.createSettings(args));
      toast.success(t('features.notifications.toasts.settingsCreated'));
      onServerError(result, () =>
        toast.error(t('features.notifications.toasts.settingsCreateFailed'))
      );
      return result;
    },
    [zero, t]
  );

  // ── Push Subscriptions ─────────────────────────────────────────────
  const registerPushSubscription = useCallback(
    (args: Parameters<typeof mutators.notifications.registerPushSubscription>[0]) => {
      const result = zero.mutate(mutators.notifications.registerPushSubscription(args));
      onServerError(result, () => toast.error(t('features.notifications.toasts.pushEnableFailed')));
      return result;
    },
    [zero, t]
  );

  const unregisterPushSubscription = useCallback(
    (args: Parameters<typeof mutators.notifications.unregisterPushSubscription>[0]) => {
      const result = zero.mutate(mutators.notifications.unregisterPushSubscription(args));
      onServerError(result, () =>
        toast.error(t('features.notifications.toasts.pushDisableFailed'))
      );
      return result;
    },
    [zero, t]
  );

  // ── Entity Notification Reads ──────────────────────────────────────
  const markEntityNotificationRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markEntityNotificationRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markEntityNotificationRead(args));
      onServerError(result, msg =>
        console.error('Failed to mark entity notification as read:', msg)
      );
      return result;
    },
    [zero]
  );

  const markAllEntityNotificationsRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markAllEntityNotificationsRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markAllEntityNotificationsRead(args));
      onServerError(result, msg =>
        console.error('Failed to mark all entity notifications as read:', msg)
      );
      return result;
    },
    [zero]
  );

  return {
    // Read Status
    setNotificationRead,
    setAllNotificationsRead,
    markRead,
    markAllRead,

    // Delete
    dismissNotification,
    restoreNotification,
    purgeNotificationForUser,
    deleteEntityNotificationGlobally,
    restoreEntityNotificationGlobally,
    createEntityNotification,
    updateEntityNotification,
    deleteNotification,

    // Settings
    updateSettings,
    createSettings,

    // Push Subscriptions
    registerPushSubscription,
    unregisterPushSubscription,

    // Entity Notification Reads
    markEntityNotificationRead,
    markAllEntityNotificationsRead,
  };
}
