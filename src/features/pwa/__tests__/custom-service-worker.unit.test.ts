import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it, vi } from 'vitest';

const serviceWorkerUrl = new URL('../../../../public/custom-sw.js', import.meta.url);
const serviceWorkerPath = fileURLToPath(serviceWorkerUrl);
const serviceWorkerSource = readFileSync(serviceWorkerUrl, 'utf8');

type WorkerEventHandler = (event: Record<string, unknown>) => void;

interface HarnessOptions {
  importScriptsBehavior?: 'throw' | 'without-workbox' | 'with-workbox';
  manifest?: unknown[];
}

function createServiceWorkerHarness(options: HarnessOptions = {}) {
  const handlers = new Map<string, WorkerEventHandler>();
  const timers = new Map<number, () => void>();
  const allTimerCallbacks: (() => void)[] = [];
  let nextTimerId = 1;

  const showNotification = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const fetchMock = vi.fn();
  let persistedLanguage: string | null = null;
  const navigationCache = new Map<unknown, Response>();
  const consoleMock = {
    error: vi.fn(),
    warn: vi.fn(),
  };
  const clients = {
    claim: vi.fn().mockResolvedValue(undefined),
    matchAll,
    openWindow: vi.fn(),
  };
  const self = {
    __WB_MANIFEST: options.manifest,
    location: { origin: 'https://polity.test' },
    registration: { showNotification },
    addEventListener: vi.fn((type: string, handler: WorkerEventHandler) => {
      handlers.set(type, handler);
    }),
    skipWaiting: vi.fn(),
  };
  const cacheMatch = vi.fn(async (key: unknown) => {
    if (key === '/__polity/settings/language' && persistedLanguage) {
      return new Response(persistedLanguage);
    }
    return navigationCache.get(key);
  });
  const cachePut = vi.fn(async (key: unknown, response: Response) => {
    if (key === '/__polity/settings/language') {
      persistedLanguage = await response.text();
      return;
    }
    navigationCache.set(key, response);
  });
  const openCache = vi.fn(async () => ({ match: cacheMatch, put: cachePut }));
  class Strategy {
    constructor(readonly settings: unknown) {}
  }
  class ExpirationPlugin extends Strategy {}
  const workbox = {
    expiration: { ExpirationPlugin },
    precaching: { precacheAndRoute: vi.fn() },
    routing: { registerRoute: vi.fn() },
    setConfig: vi.fn(),
    strategies: {
      CacheFirst: Strategy,
      NetworkFirst: Strategy,
      StaleWhileRevalidate: Strategy,
    },
  };

  runInNewContext(
    serviceWorkerSource,
    {
      MessageChannel,
      Response,
      URL,
      caches: {
        open: openCache,
      },
      clearTimeout: (timerId: number) => timers.delete(timerId),
      clients,
      console: consoleMock,
      fetch: fetchMock,
      importScripts: () => {
        if ((options.importScriptsBehavior ?? 'throw') === 'throw') {
          throw new Error('Workbox is intentionally unavailable in this unit test');
        }
      },
      self,
      setTimeout: (callback: () => void) => {
        const timerId = nextTimerId;
        nextTimerId += 1;
        timers.set(timerId, callback);
        allTimerCallbacks.push(callback);
        return timerId;
      },
      ...(options.importScriptsBehavior === 'with-workbox' ? { workbox } : {}),
    },
    { filename: serviceWorkerPath }
  );

  function dispatchPush(payload?: Record<string, unknown>, parseError?: Error) {
    let lifetime: Promise<unknown> | undefined;
    handlers.get('push')?.({
      data:
        payload || parseError
          ? {
              json: () => {
                if (parseError) throw parseError;
                return payload;
              },
            }
          : null,
      waitUntil: (promise: Promise<unknown>) => {
        lifetime = promise;
      },
    });
    if (!lifetime) throw new Error('Push handler did not extend the event lifetime');
    return lifetime;
  }

  function dispatchMessage(language: string) {
    let lifetime: Promise<unknown> | undefined;
    handlers.get('message')?.({
      data: { type: 'polity:set-language:v1', language },
      waitUntil: (promise: Promise<unknown>) => {
        lifetime = promise;
      },
    });
    if (!lifetime) throw new Error('Message handler did not extend the event lifetime');
    return lifetime;
  }

  function dispatchRawMessage(data: unknown) {
    let lifetime: Promise<unknown> | undefined;
    handlers.get('message')?.({
      data,
      waitUntil: (promise: Promise<unknown>) => {
        lifetime = promise;
      },
    });
    return lifetime;
  }

  function dispatchFetch(request: Record<string, unknown>) {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')?.({
      request,
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });
    return response;
  }

  function dispatchNavigation(
    request: Record<string, unknown> = { method: 'GET', mode: 'navigate' }
  ) {
    const response = dispatchFetch(request);
    if (!response) throw new Error('Fetch handler did not provide a response');
    return response;
  }

  function dispatchNotificationClick(
    notification: { close: () => void; data?: { url?: string } },
    action = ''
  ) {
    let lifetime: Promise<unknown> | undefined;
    handlers.get('notificationclick')?.({
      action,
      notification,
      waitUntil: (promise: Promise<unknown>) => {
        lifetime = promise;
      },
    });
    if (!lifetime) throw new Error('Notification click did not extend the event lifetime');
    return lifetime;
  }

  function dispatchLifecycle(type: 'activate' | 'install' | 'notificationclose') {
    let lifetime: Promise<unknown> | undefined;
    handlers.get(type)?.({
      waitUntil: (promise: Promise<unknown>) => {
        lifetime = promise;
      },
    });
    return lifetime;
  }

  function dispatchSync(tag: string) {
    let lifetime: Promise<unknown> | undefined;
    handlers.get('sync')?.({
      tag,
      waitUntil: (promise: Promise<unknown>) => {
        lifetime = promise;
      },
    });
    return lifetime;
  }

  return {
    allTimerCallbacks,
    cacheMatch,
    cachePut,
    clients,
    consoleMock,
    dispatchFetch,
    dispatchLifecycle,
    dispatchNotificationClick,
    dispatchPush,
    dispatchMessage,
    dispatchNavigation,
    dispatchRawMessage,
    dispatchSync,
    expireAcknowledgement: () => {
      for (const callback of [...timers.values()]) callback();
    },
    matchAll,
    pendingAcknowledgements: () => timers.size,
    navigationCache,
    openCache,
    showNotification,
    fetchMock,
    workbox,
  };
}

function notificationPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Neue Abstimmung',
    message: 'Die Abstimmung ist jetzt geöffnet.',
    actionUrl: '/events/event-1',
    notificationId: 'notification-1',
    tag: 'voting-open',
    type: 'event_voting_started',
    foregroundBehavior: 'toast',
    ...overrides,
  };
}

describe('custom service worker foreground push delivery', () => {
  it('configures Workbox precaching and runtime routes when the CDN loads', () => {
    const manifest = [{ url: '/asset.js', revision: 'one' }];
    const worker = createServiceWorkerHarness({
      importScriptsBehavior: 'with-workbox',
      manifest,
    });

    expect(worker.workbox.setConfig).toHaveBeenCalledWith({ debug: false });
    expect(worker.workbox.precaching.precacheAndRoute).toHaveBeenCalledWith(manifest);
    expect(worker.workbox.routing.registerRoute).toHaveBeenCalledTimes(3);
  });

  it('uses an empty manifest and no runtime routes when Workbox is unavailable', () => {
    const readyWorker = createServiceWorkerHarness({ importScriptsBehavior: 'with-workbox' });
    const unavailableWorker = createServiceWorkerHarness({
      importScriptsBehavior: 'without-workbox',
    });

    expect(readyWorker.workbox.precaching.precacheAndRoute).toHaveBeenCalledWith([]);
    expect(unavailableWorker.workbox.setConfig).not.toHaveBeenCalled();
    expect(unavailableWorker.consoleMock.warn).not.toHaveBeenCalled();
  });

  it('persists the selected language and localizes notification fallbacks', async () => {
    const worker = createServiceWorkerHarness();

    await worker.dispatchMessage('de');
    await worker.dispatchPush();

    expect(worker.showNotification).toHaveBeenCalledWith(
      'Neue Benachrichtigung',
      expect.objectContaining({ body: 'Du hast eine neue Nachricht' })
    );
  });

  it('ignores unrelated and unsupported language messages', async () => {
    const worker = createServiceWorkerHarness();

    expect(worker.dispatchRawMessage({ type: 'other', language: 'de' })).toBeUndefined();
    await worker.dispatchMessage('fr');

    expect(worker.openCache).not.toHaveBeenCalled();
  });

  it('logs language persistence and lookup failures and retains English fallbacks', async () => {
    const worker = createServiceWorkerHarness();
    worker.openCache.mockRejectedValueOnce(new Error('Cache write failed'));

    await worker.dispatchMessage('de');
    expect(worker.consoleMock.warn).toHaveBeenCalledWith(
      '[Service Worker] Could not persist language:',
      expect.any(Error)
    );

    worker.openCache.mockRejectedValueOnce(new Error('Cache read failed'));
    await worker.dispatchPush();
    expect(worker.consoleMock.warn).toHaveBeenCalledWith(
      '[Service Worker] Could not read language:',
      expect.any(Error)
    );
    expect(worker.showNotification).toHaveBeenLastCalledWith(
      'New notification',
      expect.objectContaining({ body: 'You have a new message' })
    );
  });

  it('uses the persisted language for the offline navigation response', async () => {
    const worker = createServiceWorkerHarness();
    worker.fetchMock.mockRejectedValue(new Error('Offline'));

    await worker.dispatchMessage('de');
    const response = await worker.dispatchNavigation();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('Polity ist derzeit offline.');
  });

  it('sends a toast event to exactly the focused window and suppresses after acknowledgement', async () => {
    const worker = createServiceWorkerHarness();
    const focusedWindow = {
      focused: true,
      postMessage: vi.fn(
        (_message: Record<string, unknown>, [acknowledgementPort]: [MessagePort]) =>
          acknowledgementPort.postMessage({ handled: true })
      ),
    };
    const otherWindow = {
      focused: false,
      postMessage: vi.fn(),
    };
    worker.matchAll.mockResolvedValue([focusedWindow, otherWindow]);

    await worker.dispatchPush(notificationPayload());

    expect(worker.showNotification).not.toHaveBeenCalled();
    expect(otherWindow.postMessage).not.toHaveBeenCalled();
    expect(focusedWindow.postMessage).toHaveBeenCalledOnce();
    expect(focusedWindow.postMessage.mock.calls[0]?.[0]).toEqual({
      type: 'polity:foreground-push:v1',
      notification: {
        title: 'Neue Abstimmung',
        body: 'Die Abstimmung ist jetzt geöffnet.',
        url: '/events/event-1',
        notificationId: 'notification-1',
        notificationType: 'event_voting_started',
        tag: 'voting-open',
      },
    });
  });

  it('falls back to a system notification when acknowledgement times out', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([
      {
        focused: true,
        postMessage: vi.fn(),
      },
    ]);

    const lifetime = worker.dispatchPush(notificationPayload());
    await vi.waitFor(() => expect(worker.pendingAcknowledgements()).toBe(1));
    worker.expireAcknowledgement();
    await lifetime;

    expect(worker.showNotification).toHaveBeenCalledOnce();
  });

  it('falls back when a focused client rejects the foreground message', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([
      {
        focused: true,
        postMessage: vi.fn(() => {
          throw new Error('Port transfer failed');
        }),
      },
    ]);

    await worker.dispatchPush(notificationPayload());

    expect(worker.consoleMock.warn).toHaveBeenCalledWith(
      '[Service Worker] Could not deliver foreground push:',
      expect.any(Error)
    );
    expect(worker.showNotification).toHaveBeenCalledOnce();
  });

  it('falls back when a focused client explicitly declines the toast', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([
      {
        focused: true,
        postMessage: vi.fn(
          (_message: Record<string, unknown>, [acknowledgementPort]: [MessagePort]) =>
            acknowledgementPort.postMessage({ handled: false })
        ),
      },
    ]);

    await worker.dispatchPush(notificationPayload());

    expect(worker.showNotification).toHaveBeenCalledOnce();
  });

  it('settles a foreground acknowledgement only once', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([
      {
        focused: true,
        postMessage: vi.fn(
          (_message: Record<string, unknown>, [acknowledgementPort]: [MessagePort]) =>
            acknowledgementPort.postMessage({ handled: true })
        ),
      },
    ]);

    await worker.dispatchPush(notificationPayload());
    for (const callback of worker.allTimerCallbacks) callback();

    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it('shows a system notification when no window is focused', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([
      {
        focused: false,
        postMessage: vi.fn(),
      },
    ]);

    await worker.dispatchPush(notificationPayload());

    expect(worker.showNotification).toHaveBeenCalledOnce();
  });

  it('shows a system notification when client lookup fails', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockRejectedValue(new Error('Client lookup failed'));

    await worker.dispatchPush(notificationPayload());

    expect(worker.showNotification).toHaveBeenCalledOnce();
    expect(worker.consoleMock.warn).toHaveBeenCalledWith(
      '[Service Worker] Foreground detection failed:',
      expect.any(Error)
    );
  });

  it.each([
    ['an old payload without foreground behavior', {}],
    ['an unknown foreground behavior', { foregroundBehavior: 'unknown' }],
    ['a push-only payload', { foregroundBehavior: 'system' }],
    ['a test payload', { foregroundBehavior: 'system', tag: 'push-test:test-1' }],
  ])(
    'always shows a system notification for %s even with a focused window',
    async (_label, fields) => {
      const worker = createServiceWorkerHarness();
      const focusedWindow = {
        focused: true,
        postMessage: vi.fn(),
      };
      worker.matchAll.mockResolvedValue([focusedWindow]);
      const payload = notificationPayload(fields);
      if (!Object.hasOwn(fields, 'foregroundBehavior')) delete payload.foregroundBehavior;

      await worker.dispatchPush(payload);

      expect(worker.showNotification).toHaveBeenCalledOnce();
      expect(worker.matchAll).not.toHaveBeenCalled();
      expect(focusedWindow.postMessage).not.toHaveBeenCalled();
    }
  );

  it('falls back safely when the payload cannot be parsed', async () => {
    const worker = createServiceWorkerHarness();

    await worker.dispatchPush(undefined, new Error('Invalid JSON'));

    expect(worker.showNotification).toHaveBeenCalledOnce();
    expect(worker.consoleMock.error).toHaveBeenCalledWith(
      '[Service Worker] Error parsing push data:',
      expect.any(Error)
    );
  });

  it('applies language and secondary payload fallbacks without losing custom data', async () => {
    const worker = createServiceWorkerHarness();

    await worker.dispatchPush({
      language: 'de',
      body: 'Alternative body',
      url: '/alternative',
      icon: '/custom-icon.png',
      badge: '/custom-badge.png',
      type: 'custom-type',
      requireInteraction: true,
      actions: [{ action: 'open', title: 'Open' }],
      data: { correlationId: 'correlation-one' },
    });

    expect(worker.showNotification).toHaveBeenCalledWith(
      'Neue Benachrichtigung',
      expect.objectContaining({
        body: 'Alternative body',
        icon: '/custom-icon.png',
        badge: '/custom-badge.png',
        tag: 'custom-type',
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Open' }],
        data: expect.objectContaining({
          url: '/alternative',
          correlationId: 'correlation-one',
        }),
      })
    );
  });

  it('uses every final notification fallback for a minimal payload', async () => {
    const worker = createServiceWorkerHarness();

    await worker.dispatchPush({});

    expect(worker.showNotification).toHaveBeenCalledWith(
      'New notification',
      expect.objectContaining({
        body: 'You have a new message',
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: 'notification',
        requireInteraction: false,
        actions: [],
        data: expect.objectContaining({ url: '/' }),
      })
    );
  });
});

describe('custom service worker notification actions and lifecycle', () => {
  it('focuses, navigates and closes an existing same-origin notification client', async () => {
    const worker = createServiceWorkerHarness();
    const navigate = vi.fn().mockResolvedValue('navigated');
    const focus = vi.fn().mockResolvedValue({ navigate });
    worker.matchAll.mockResolvedValue([
      { url: 'https://other.test/page' },
      { url: 'https://polity.test/current', focus },
    ]);
    const notification = {
      close: vi.fn(),
      data: { url: '/target' },
    };

    await worker.dispatchNotificationClick(notification, 'open');

    expect(notification.close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('https://polity.test/target');
    expect(worker.clients.openWindow).not.toHaveBeenCalled();
  });

  it('returns a focused client that cannot navigate', async () => {
    const worker = createServiceWorkerHarness();
    const focusedClient = { marker: 'focused' };
    const focus = vi.fn().mockResolvedValue(focusedClient);
    worker.matchAll.mockResolvedValue([{ url: 'https://polity.test/current', focus }]);

    await expect(
      worker.dispatchNotificationClick({ close: vi.fn(), data: { url: '/target' } })
    ).resolves.toBe(focusedClient);
  });

  it('opens a new window with the default URL when no client can focus', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([{ url: 'https://other.test/current' }]);
    worker.clients.openWindow.mockResolvedValue('opened');

    await expect(worker.dispatchNotificationClick({ close: vi.fn() })).resolves.toBe('opened');
    expect(worker.clients.openWindow).toHaveBeenCalledWith('/');
  });

  it('finishes safely when neither a focusable client nor openWindow exists', async () => {
    const worker = createServiceWorkerHarness();
    worker.matchAll.mockResolvedValue([]);
    (worker.clients as { openWindow?: unknown }).openWindow = undefined;

    await expect(
      worker.dispatchNotificationClick({ close: vi.fn(), data: { url: '/target' } })
    ).resolves.toBeUndefined();
  });

  it('handles install, activation, close and matching background sync events', async () => {
    const worker = createServiceWorkerHarness();

    expect(worker.dispatchLifecycle('install')).toBeUndefined();
    expect(worker.dispatchLifecycle('notificationclose')).toBeUndefined();
    expect(worker.dispatchSync('other')).toBeUndefined();
    await worker.dispatchSync('sync-push-subscription');
    await worker.dispatchLifecycle('activate');

    expect(worker.clients.claim).toHaveBeenCalledOnce();
  });
});

describe('custom service worker navigation caching', () => {
  it('ignores non-navigation and non-GET requests', () => {
    const worker = createServiceWorkerHarness();

    expect(worker.dispatchFetch({ method: 'POST', mode: 'navigate' })).toBeUndefined();
    expect(worker.dispatchFetch({ method: 'GET', mode: 'cors' })).toBeUndefined();
    expect(worker.fetchMock).not.toHaveBeenCalled();
  });

  it('stores successful basic navigation responses', async () => {
    const worker = createServiceWorkerHarness();
    const request = { method: 'GET', mode: 'navigate', url: 'https://polity.test/group/one' };
    const clone = vi.fn(() => new Response('cached'));
    const response = { ok: true, type: 'basic', clone };
    worker.fetchMock.mockResolvedValue(response);

    await expect(worker.dispatchNavigation(request)).resolves.toBe(response);

    expect(clone).toHaveBeenCalledOnce();
    expect(worker.cachePut).toHaveBeenCalledWith(request, expect.any(Response));
  });

  it.each([
    ['an unsuccessful response', { ok: false, type: 'basic' }],
    ['a non-basic response', { ok: true, type: 'cors' }],
  ])('does not cache %s', async (_label, response) => {
    const worker = createServiceWorkerHarness();
    worker.fetchMock.mockResolvedValue(response);

    await expect(worker.dispatchNavigation()).resolves.toBe(response);

    expect(worker.cachePut).not.toHaveBeenCalled();
  });

  it('returns an exact cached navigation before the cached root', async () => {
    const worker = createServiceWorkerHarness();
    const request = { method: 'GET', mode: 'navigate' };
    const cached = new Response('exact');
    worker.fetchMock.mockRejectedValue(new Error('Offline'));
    worker.cacheMatch.mockImplementation(async key => (key === request ? cached : undefined));

    await expect(worker.dispatchNavigation(request)).resolves.toBe(cached);
  });

  it('returns the cached root when the exact navigation is absent', async () => {
    const worker = createServiceWorkerHarness();
    const cachedRoot = new Response('root');
    worker.fetchMock.mockRejectedValue(new Error('Offline'));
    worker.cacheMatch.mockImplementation(async key => (key === '/' ? cachedRoot : undefined));

    await expect(worker.dispatchNavigation()).resolves.toBe(cachedRoot);
  });

  it('uses English offline copy for an unsupported cached language', async () => {
    const worker = createServiceWorkerHarness();
    worker.fetchMock.mockRejectedValue(new Error('Offline'));
    worker.cacheMatch.mockImplementation(async key =>
      key === '/__polity/settings/language' ? new Response('fr') : undefined
    );

    const response = await worker.dispatchNavigation();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('Polity is currently offline.');
  });
});
