import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

/**
 * Action hook for notification mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useNotificationActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── Read Status ────────────────────────────────────────────────────
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
      toast.success(t('features.notifications.toasts.allMarkedRead'));
      onServerError(result, () =>
        toast.error(t('features.notifications.toasts.markAllReadFailed'))
      );
      return result;
    },
    [zero, t]
  );

  // ── Delete ─────────────────────────────────────────────────────────
  const deleteNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.delete>[0]) => {
      const result = zero.mutate(mutators.notifications.delete(args));
      toast.success(t('features.notifications.toasts.deleted'));
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
      toast.success(t('features.notifications.toasts.pushEnabled'));
      onServerError(result, () => toast.error(t('features.notifications.toasts.pushEnableFailed')));
      return result;
    },
    [zero, t]
  );

  const unregisterPushSubscription = useCallback(
    (args: Parameters<typeof mutators.notifications.unregisterPushSubscription>[0]) => {
      const result = zero.mutate(mutators.notifications.unregisterPushSubscription(args));
      toast.success(t('features.notifications.toasts.pushDisabled'));
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
    markRead,
    markAllRead,

    // Delete
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
