/* global caches, clearTimeout, clients, console, fetch, importScripts, MessageChannel, Response, self, setTimeout, URL, workbox */

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

const FOREGROUND_PUSH_MESSAGE_TYPE = 'polity:foreground-push:v1';
const FOREGROUND_PUSH_ACK_TIMEOUT_MS = 500;
const LANGUAGE_MESSAGE_TYPE = 'polity:set-language:v1';
const LANGUAGE_CACHE = 'polity-settings-v1';
const LANGUAGE_CACHE_KEY = '/__polity/settings/language';
const LOCALIZED_FALLBACK_COPY = {
  en: {
    notificationTitle: 'New notification',
    notificationBody: 'You have a new message',
    offline: 'Polity is currently offline.',
  },
  de: {
    notificationTitle: 'Neue Benachrichtigung',
    notificationBody: 'Du hast eine neue Nachricht',
    offline: 'Polity ist derzeit offline.',
  },
};

function isSupportedLanguage(language) {
  return language === 'de' || language === 'en';
}

async function persistLanguage(language) {
  if (!isSupportedLanguage(language)) return;
  try {
    const cache = await caches.open(LANGUAGE_CACHE);
    await cache.put(
      LANGUAGE_CACHE_KEY,
      new Response(language, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  } catch (error) {
    console.warn('[Service Worker] Could not persist language:', error);
  }
}

async function readPersistedLanguage() {
  try {
    const cache = await caches.open(LANGUAGE_CACHE);
    const response = await cache.match(LANGUAGE_CACHE_KEY);
    const language = response ? await response.text() : null;
    return isSupportedLanguage(language) ? language : 'en';
  } catch (error) {
    console.warn('[Service Worker] Could not read language:', error);
    return 'en';
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== LANGUAGE_MESSAGE_TYPE) return;
  event.waitUntil(persistLanguage(event.data.language));
});

function showSystemNotification(notificationData) {
  return self.registration.showNotification(notificationData.title, notificationData);
}

function requestForegroundToast(windowClient, notificationData) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;

    const finish = (handled) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      resolve(handled);
    };

    const timeout = setTimeout(() => finish(false), FOREGROUND_PUSH_ACK_TIMEOUT_MS);
    channel.port1.onmessage = (messageEvent) => {
      finish(messageEvent.data?.handled === true);
    };

    try {
      windowClient.postMessage(
        {
          type: FOREGROUND_PUSH_MESSAGE_TYPE,
          notification: {
            title: notificationData.title,
            body: notificationData.body,
            url: notificationData.data.url,
            notificationId: notificationData.data?.notificationId,
            notificationType: notificationData.data?.type,
            tag: notificationData.tag,
          },
        },
        [channel.port2]
      );
    } catch (error) {
      console.warn('[Service Worker] Could not deliver foreground push:', error);
      finish(false);
    }
  });
}

async function deliverPushNotification(notificationData, foregroundBehavior) {
  if (foregroundBehavior !== 'toast') {
    return showSystemNotification(notificationData);
  }

  try {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const focusedClient = windowClients.find((windowClient) => windowClient.focused === true);

    if (focusedClient && (await requestForegroundToast(focusedClient, notificationData))) {
      return;
    }
  } catch (error) {
    console.warn('[Service Worker] Foreground detection failed:', error);
  }

  return showSystemNotification(notificationData);
}

/**
 * Handle push notification event
 * This is triggered when the server sends a push notification
 */
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let language = await readPersistedLanguage();
      let foregroundBehavior = 'system';
      let data = null;

      if (event.data) {
        try {
          data = event.data.json();
          if (isSupportedLanguage(data.language)) language = data.language;
        } catch (error) {
          console.error('[Service Worker] Error parsing push data:', error);
        }
      }

      const fallbackCopy = LOCALIZED_FALLBACK_COPY[language];
      let notificationData = {
        title: fallbackCopy.notificationTitle,
        body: fallbackCopy.notificationBody,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: 'notification',
        requireInteraction: false,
        data: {
          url: '/',
        },
      };

      if (data) {
        foregroundBehavior = data.foregroundBehavior === 'toast' ? 'toast' : 'system';
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
      }

      return deliverPushNotification(notificationData, foregroundBehavior);
    })()
  );
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
self.addEventListener('notificationclose', () => {
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
  // Placeholder for retrying a failed subscription write. Resolving keeps the
  // browser sync lifecycle deterministic until a real retry queue is added.
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

    const language = await readPersistedLanguage();
    return new Response(LOCALIZED_FALLBACK_COPY[language].offline, {
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
