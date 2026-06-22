/* global caches, clients, console, fetch, importScripts, Response, self, URL, workbox */

// Custom Service Worker for Push Notifications
// This extends the default PWA service worker with push notification capabilities

let workboxReady = false;

try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
  workboxReady = typeof workbox !== 'undefined';
} catch (error) {
  console.warn('[Service Worker] Workbox could not be loaded:', error);
}

if (workboxReady) {
  workbox.setConfig({
    debug: false,
  });

  const { precacheAndRoute } = workbox.precaching;

  // Precache files (will be populated by next-pwa)
  precacheAndRoute(self.__WB_MANIFEST || []);
}

// ============================================================================
// PUSH NOTIFICATION HANDLERS
// ============================================================================

/**
 * Handle push notification event
 * This is triggered when the server sends a push notification
 */
self.addEventListener('push', (event) => {

  // Default notification options
  let notificationData = {
    title: 'Neue Benachrichtigung',
    body: 'Sie haben eine neue Nachricht',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'notification',
    requireInteraction: false,
    data: {
      url: '/',
    },
  };

  // Parse push notification data
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.message || data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || data.type || notificationData.tag,
        requireInteraction: data.requireInteraction || false,
        data: {
          url: data.actionUrl || data.url || '/',
          notificationId: data.notificationId,
          type: data.type,
          ...data.data,
        },
        actions: data.actions || [],
      };
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
    }
  }

  // Show the notification
  const promiseChain = self.registration.showNotification(
    notificationData.title,
    notificationData
  );

  event.waitUntil(promiseChain);
});

/**
 * Handle notification click event
 * This is triggered when the user clicks on a notification
 */
self.addEventListener('notificationclick', (event) => {

  // Close the notification
  event.notification.close();

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/';

  // Handle notification actions (if any)
  if (event.action) {
    // You can add custom action handlers here
  }

  // Open the URL in a new window or focus existing window
  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // Check if there's already a window open with this URL
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(urlToOpen, self.location.origin);

        // If we find a window with matching origin, focus it and navigate
        if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
          return client.focus().then((client) => {
            // Navigate to the target URL
            if (client.navigate) {
              return client.navigate(targetUrl.href);
            }
            return client;
          });
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});

/**
 * Handle notification close event
 * This is triggered when the user dismisses a notification
 */
self.addEventListener('notificationclose', (event) => {
  // You can track notification dismissals here
});

// ============================================================================
// BACKGROUND SYNC FOR FAILED PUSH SUBSCRIPTIONS
// ============================================================================

/**
 * Handle background sync event
 * This can be used to retry failed push subscription updates
 */
self.addEventListener('sync', (event) => {

  if (event.tag === 'sync-push-subscription') {
    event.waitUntil(syncPushSubscription());
  }
});

async function syncPushSubscription() {
  try {
    // Implement logic to sync push subscription with server
    // This would typically retry storing the subscription in your database
  } catch (error) {
    console.error('[Service Worker] Error syncing push subscription:', error);
    throw error; // Re-throw to retry on next sync
  }
}

// ============================================================================
// CACHE STRATEGIES (from next-pwa configuration)
// ============================================================================

if (workboxReady) {
  const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;

  // Google Fonts
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
    new CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        }),
      ],
    })
  );

  // Images
  workbox.routing.registerRoute(
    /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    new StaleWhileRevalidate({
      cacheName: 'static-image-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
    })
  );

  // API calls
  workbox.routing.registerRoute(
    /\/api\/.*$/i,
    new NetworkFirst({
      cacheName: 'apis',
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
    }),
    'GET'
  );
}

const NAVIGATION_CACHE = 'polity-navigation-v1';

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(handleNavigationRequest(event.request));
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(NAVIGATION_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[Service Worker] Navigation request failed:', error);

    const cachedResponse = await cache.match(request);
    const cachedRoot = await cache.match('/');

    if (cachedResponse || cachedRoot) {
      return cachedResponse || cachedRoot;
    }

    return new Response('Polity is offline right now.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

// ============================================================================
// SERVICE WORKER LIFECYCLE
// ============================================================================

self.addEventListener('install', () => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});
