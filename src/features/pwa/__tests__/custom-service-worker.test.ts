import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it, vi } from 'vitest';

const serviceWorkerSource = readFileSync(
  new URL('../../../../public/custom-sw.js', import.meta.url),
  'utf8'
);

type WorkerEventHandler = (event: Record<string, unknown>) => void;

function createServiceWorkerHarness() {
  const handlers = new Map<string, WorkerEventHandler>();
  const timers = new Map<number, () => void>();
  let nextTimerId = 1;

  const showNotification = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const fetchMock = vi.fn();
  let persistedLanguage: string | null = null;
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
    __WB_MANIFEST: [],
    location: { origin: 'https://polity.test' },
    registration: { showNotification },
    addEventListener: vi.fn((type: string, handler: WorkerEventHandler) => {
      handlers.set(type, handler);
    }),
    skipWaiting: vi.fn(),
  };

  runInNewContext(serviceWorkerSource, {
    MessageChannel,
    Response,
    URL,
    caches: {
      open: vi.fn(async (cacheName: string) => ({
        match: vi.fn(async (key: string) =>
          cacheName === 'polity-settings-v1' &&
          key === '/__polity/settings/language' &&
          persistedLanguage
            ? new Response(persistedLanguage)
            : undefined
        ),
        put: vi.fn(async (key: string, response: Response) => {
          if (cacheName === 'polity-settings-v1' && key === '/__polity/settings/language') {
            persistedLanguage = await response.text();
          }
        }),
      })),
    },
    clearTimeout: (timerId: number) => timers.delete(timerId),
    clients,
    console: consoleMock,
    fetch: fetchMock,
    importScripts: () => {
      throw new Error('Workbox is intentionally unavailable in this unit test');
    },
    self,
    setTimeout: (callback: () => void) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
  });

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

  function dispatchNavigation() {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')?.({
      request: { method: 'GET', mode: 'navigate' },
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });
    if (!response) throw new Error('Fetch handler did not provide a response');
    return response;
  }

  return {
    consoleMock,
    dispatchPush,
    dispatchMessage,
    dispatchNavigation,
    expireAcknowledgement: () => {
      for (const callback of [...timers.values()]) callback();
    },
    matchAll,
    pendingAcknowledgements: () => timers.size,
    showNotification,
    fetchMock,
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
  it('persists the selected language and localizes notification fallbacks', async () => {
    const worker = createServiceWorkerHarness();

    await worker.dispatchMessage('de');
    await worker.dispatchPush();

    expect(worker.showNotification).toHaveBeenCalledWith(
      'Neue Benachrichtigung',
      expect.objectContaining({ body: 'Du hast eine neue Nachricht' })
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
});
