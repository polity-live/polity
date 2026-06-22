import { useEffect, useRef } from 'react';
import { useNotificationState } from '@/zero/notifications/useNotificationState';

/**
 * Shows native browser notifications (Web Notifications API) when new
 * unread notifications arrive while the user has the tab open.
 *
 * Prerequisites:
 *  - Notification.permission === 'granted' (obtained via push-notification toggle)
 *  - deliverySettings.inAppNotifications !== false
 *
 * Only fires for notifications that arrive AFTER the initial data load,
 * so existing unreads don't trigger a flood on page load.
 */
export function useBrowserNotifications() {
  const { unread, settings, isLoading } = useNotificationState();
  // null = not yet seeded (waiting for Zero to load)
  const seenIdsRef = useRef<Set<string> | null>(null);

  // ── Seed seen IDs once Zero has finished its initial sync ──────────
  // Every notification present at this point is "already known" and will
  // NOT trigger a browser notification.
  useEffect(() => {
    if (seenIdsRef.current !== null) return; // already seeded
    if (isLoading) {
      return;
    }

    const ids = new Set<string>();
    for (const n of unread) {
      ids.add(n.id);
    }
    seenIdsRef.current = ids;
  }, [unread, isLoading]);

  // ── Watch for new unread notifications ─────────────────────────────
  useEffect(() => {
    if (seenIdsRef.current === null) {
      return;
    }
    if (!unread || unread.length === 0) {
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }

    // Check delivery settings
    const deliverySettings = settings?.delivery_settings;
    const enabled = deliverySettings
      ? (deliverySettings as Record<string, boolean>).inAppNotifications !== false
      : true;
    if (!enabled) {
      return;
    }

    for (const n of unread) {
      if (seenIdsRef.current.has(n.id)) continue;
      seenIdsRef.current.add(n.id);

      // Use ServiceWorkerRegistration.showNotification when a SW is active,
      // because browsers suppress page-level `new Notification()` when a
      // service worker is registered.
      const actionUrl = n.action_url;
      const notifOptions = {
        body: n.message || '',
        icon: '/android-chrome-192x192.png',
        tag: `polity-${n.id}`,
        requireInteraction: true, // stay visible until dismissed
        data: { url: actionUrl },
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then(reg => {
            return reg.showNotification(n.title || 'Polity', notifOptions);
          })
          .catch(err => {
            console.error(
              '[BrowserNotif] SW showNotification failed, falling back to Notification API',
              err
            );
            new Notification(n.title || 'Polity', notifOptions);
          });
      } else {
        new Notification(n.title || 'Polity', notifOptions);
      }
    }
  }, [unread, settings]);
}
