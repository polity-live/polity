import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for notification mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useNotificationActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── Read Status ────────────────────────────────────────────────────
  const markRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markRead(args))
      onServerError(result, () => toast.error(t('features.notifications.toasts.markReadFailed')))
    },
    [zero]
  )

  const markAllRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markAllRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markAllRead(args))
      toast.success(t('features.notifications.toasts.allMarkedRead'))
      onServerError(result, () => toast.error(t('features.notifications.toasts.markAllReadFailed')))
    },
    [zero]
  )

  // ── Delete ─────────────────────────────────────────────────────────
  const deleteNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.delete>[0]) => {
      const result = zero.mutate(mutators.notifications.delete(args))
      toast.success(t('features.notifications.toasts.deleted'))
      onServerError(result, () => toast.error(t('features.notifications.toasts.deleteFailed')))
    },
    [zero]
  )

  // ── Settings ───────────────────────────────────────────────────────
  const updateSettings = useCallback(
    (args: Parameters<typeof mutators.notifications.updateSettings>[0]) => {
      const result = zero.mutate(mutators.notifications.updateSettings(args))
      toast.success(t('features.notifications.toasts.settingsUpdated'))
      onServerError(result, () => toast.error(t('features.notifications.toasts.settingsUpdateFailed')))
    },
    [zero]
  )

  const createSettings = useCallback(
    (args: Parameters<typeof mutators.notifications.createSettings>[0]) => {
      const result = zero.mutate(mutators.notifications.createSettings(args))
      toast.success(t('features.notifications.toasts.settingsCreated'))
      onServerError(result, () => toast.error(t('features.notifications.toasts.settingsCreateFailed')))
    },
    [zero]
  )

  // ── Push Subscriptions ─────────────────────────────────────────────
  const registerPushSubscription = useCallback(
    (
      args: Parameters<typeof mutators.notifications.registerPushSubscription>[0]
    ) => {
      const result = zero.mutate(mutators.notifications.registerPushSubscription(args))
      toast.success(t('features.notifications.toasts.pushEnabled'))
      onServerError(result, () => toast.error(t('features.notifications.toasts.pushEnableFailed')))
    },
    [zero]
  )

  const unregisterPushSubscription = useCallback(
    (
      args: Parameters<typeof mutators.notifications.unregisterPushSubscription>[0]
    ) => {
      const result = zero.mutate(mutators.notifications.unregisterPushSubscription(args))
      toast.success(t('features.notifications.toasts.pushDisabled'))
      onServerError(result, () => toast.error(t('features.notifications.toasts.pushDisableFailed')))
    },
    [zero]
  )

  // ── Create Notification ────────────────────────────────────────────
  const createNotification = useCallback(
    (args: Parameters<typeof mutators.notifications.createNotification>[0]) => {
      const result = zero.mutate(mutators.notifications.createNotification(args))
      onServerError(result, () => toast.error(t('features.notifications.toasts.createFailed')))
    },
    [zero]
  )

  // ── Entity Notification Reads ──────────────────────────────────────
  const markEntityNotificationRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markEntityNotificationRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markEntityNotificationRead(args))
      onServerError(result, (msg) => console.error('Failed to mark entity notification as read:', msg))
    },
    [zero]
  )

  const markAllEntityNotificationsRead = useCallback(
    (args: Parameters<typeof mutators.notifications.markAllEntityNotificationsRead>[0]) => {
      const result = zero.mutate(mutators.notifications.markAllEntityNotificationsRead(args))
      onServerError(result, (msg) => console.error('Failed to mark all entity notifications as read:', msg))
    },
    [zero]
  )

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

    // Create
    createNotification,

    // Entity Notification Reads
    markEntityNotificationRead,
    markAllEntityNotificationsRead,
  }
}
