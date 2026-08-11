/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null,
  pushApiFetch: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/features/pwa/push-api', () => ({
  pushApiFetch: (...args: unknown[]) => mocks.pushApiFetch(...args),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { usePushSubscription } from '../hooks/usePushSubscription';

const expectedApplicationServerKey = new Uint8Array([1, 2, 3, 4]);

function createSubscription(applicationServerKey = expectedApplicationServerKey) {
  return {
    endpoint: 'https://push.test/browser',
    options: { applicationServerKey: applicationServerKey.buffer },
    toJSON: () => ({
      endpoint: 'https://push.test/browser',
      keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function installBrowserPushEnvironment({
  permission = 'granted',
  permissionResult = permission,
  subscription = createSubscription(),
}: {
  permission?: NotificationPermission;
  permissionResult?: NotificationPermission;
  subscription?: PushSubscription | null;
} = {}) {
  const notification = {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permissionResult),
  };
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: notification,
  });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: notification,
  });
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManager() {
      return undefined;
    },
  });

  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscription),
    subscribe: vi.fn().mockImplementation(async () => createSubscription()),
  };
  const registration = {
    active: {},
    pushManager,
  } as unknown as ServiceWorkerRegistration;
  const serviceWorker = {
    getRegistration: vi.fn().mockResolvedValue(registration),
    register: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });

  return { notification, pushManager, registration, serviceWorker, subscription };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQIDBA');
  mocks.user = { id: 'user-a' };
  mocks.pushApiFetch.mockResolvedValue({
    subscription: {
      id: 'server-subscription',
      endpoint: 'https://push.test/browser',
      device_id: '10000000-0000-4000-8000-000000000001',
    },
  });
  window.localStorage.clear();
  window.sessionStorage.clear();
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'Win32',
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  });
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: false,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('usePushSubscription reconciliation', () => {
  it('reports activation only after the server confirms the browser subscription', async () => {
    installBrowserPushEnvironment();
    let confirmServer: (value: unknown) => void = () => undefined;
    const confirmation = new Promise(resolve => {
      confirmServer = resolve;
    });
    mocks.pushApiFetch.mockReturnValueOnce(confirmation);

    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(mocks.pushApiFetch).toHaveBeenCalledOnce());
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.serverSynchronized).toBe(false);

    await act(async () => {
      confirmServer({ subscription: { id: 'server-subscription' } });
      await confirmation;
    });
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    expect(result.current.serverSynchronized).toBe(true);
  });

  it('keeps activation false when browser and server are desynchronized', async () => {
    installBrowserPushEnvironment();
    mocks.pushApiFetch.mockRejectedValueOnce(new Error('Server synchronization failed'));

    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.error).toBe('Server synchronization failed'));
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.serverSynchronized).toBe(false);
  });

  it('removes the server device when browser permission is blocked', async () => {
    installBrowserPushEnvironment({ permission: 'denied' });

    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() =>
      expect(mocks.pushApiFetch).toHaveBeenCalledWith(
        '/api/push/subscription',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    expect(result.current.permission).toBe('denied');
    expect(result.current.isSubscribed).toBe(false);
  });

  it('rotates a subscription created with an obsolete VAPID key', async () => {
    const obsoleteSubscription = createSubscription(new Uint8Array([9, 9, 9, 9]));
    const browser = installBrowserPushEnvironment({ subscription: obsoleteSubscription });

    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    expect(obsoleteSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(browser.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expectedApplicationServerKey,
    });
    expect(mocks.pushApiFetch).toHaveBeenCalledWith(
      '/api/push/subscription',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mocks.pushApiFetch).toHaveBeenCalledWith(
      '/api/push/subscription',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('reconciles the same browser subscription after an account switch', async () => {
    installBrowserPushEnvironment();
    const { rerender } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(mocks.pushApiFetch).toHaveBeenCalledTimes(1));

    mocks.user = { id: 'user-b' };
    rerender();

    await waitFor(() => expect(mocks.pushApiFetch).toHaveBeenCalledTimes(2));
    expect(
      mocks.pushApiFetch.mock.calls.every(
        ([url, request]) =>
          url === '/api/push/subscription' && (request as RequestInit).method === 'PUT'
      )
    ).toBe(true);
  });

  it('unsubscribes both the browser and authoritative server device', async () => {
    const browser = installBrowserPushEnvironment();
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(browser.subscription?.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.pushApiFetch).toHaveBeenLastCalledWith(
      '/api/push/subscription',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result.current.isSubscribed).toBe(false);
  });

  it('reports unsupported and signed-out environments without touching the server', async () => {
    installBrowserPushEnvironment();
    mocks.user = null;

    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSupported).toBe(true);
    expect(result.current.serviceWorkerReady).toBe(false);
    expect(mocks.pushApiFetch).not.toHaveBeenCalled();
    await expect(result.current.subscribe()).rejects.toThrow(
      'components.pushNotifications.errors.notLoggedIn'
    );
    await expect(result.current.unsubscribe()).rejects.toThrow(
      'components.pushNotifications.errors.notLoggedIn'
    );

    Reflect.deleteProperty(window, 'PushManager');
    Reflect.deleteProperty(window, 'Notification');
    Reflect.deleteProperty(globalThis, 'Notification');
    mocks.user = { id: 'user-a' };
    await act(() => result.current.refresh());
    expect(result.current.isSupported).toBe(false);
    await expect(result.current.requestPermission()).rejects.toThrow(
      'components.pushNotifications.errors.notSupported'
    );
    await expect(result.current.subscribe()).rejects.toThrow(
      'components.pushNotifications.errors.notSupported'
    );
  });

  it('requires iOS installation before subscribing', async () => {
    installBrowserPushEnvironment();
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'iPhone',
    });

    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.requiresIosInstall).toBe(true));

    await act(async () => {
      await expect(result.current.subscribe()).rejects.toThrow(
        'components.pushNotifications.errors.iosInstallRequired'
      );
    });
    expect(result.current.error).toBe('components.pushNotifications.errors.iosInstallRequired');
  });

  it('requests notification permission and translates browser failures', async () => {
    const browser = installBrowserPushEnvironment();
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await expect(result.current.requestPermission()).resolves.toBe('granted');
    browser.notification.requestPermission.mockRejectedValueOnce(new Error('browser failed'));
    await expect(result.current.requestPermission()).rejects.toThrow(
      'components.pushNotifications.errors.permissionRequest'
    );
  });

  it.each([
    ['denied', 'denied', 'components.pushNotifications.errors.permissionBlocked'],
    ['default', 'default', 'components.pushNotifications.errors.permissionDismissed'],
    ['default', 'denied', 'components.pushNotifications.errors.permissionBlocked'],
  ] as const)(
    'rejects a %s permission result during subscribe',
    async (permission, permissionResult, expectedError) => {
      installBrowserPushEnvironment({ permission, permissionResult, subscription: null });
      const { result } = renderHook(() => usePushSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(result.current.subscribe()).rejects.toThrow(expectedError);
      });
      expect(result.current.error).toBe(expectedError);
      expect(result.current.isSubscribed).toBe(false);
    }
  );

  it('registers a missing service worker and creates a fresh subscription', async () => {
    const browser = installBrowserPushEnvironment({ permission: 'granted', subscription: null });
    browser.serviceWorker.getRegistration
      .mockResolvedValueOnce(browser.registration)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.pushApiFetch.mockClear();

    await act(async () => result.current.subscribe());

    expect(browser.serviceWorker.register).toHaveBeenCalledWith('/custom-sw.js', { scope: '/' });
    expect(browser.pushManager.subscribe).toHaveBeenCalledOnce();
    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.serviceWorkerReady).toBe(true);
  });

  it('replaces a subscription whose application server key is absent', async () => {
    const subscription = createSubscription();
    Object.defineProperty(subscription, 'options', {
      configurable: true,
      value: { applicationServerKey: null },
    });
    const browser = installBrowserPushEnvironment({ permission: 'granted', subscription: null });
    browser.pushManager.getSubscription
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(subscription);
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.subscribe());

    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(browser.pushManager.subscribe).toHaveBeenCalledOnce();
    expect(result.current.isSubscribed).toBe(true);
  });

  it('surfaces missing VAPID configuration and malformed subscription keys', async () => {
    const malformed = createSubscription();
    Object.defineProperty(malformed, 'toJSON', {
      configurable: true,
      value: () => ({ keys: { auth: 'auth-only' } }),
    });
    installBrowserPushEnvironment({ subscription: malformed });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.error).toBe('Invalid Web Push subscription keys'));

    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    await act(() => result.current.refresh());
    expect(result.current.error).toBe('components.pushNotifications.errors.vapidMissing');
  });

  it('rejects subscribe when VAPID configuration is missing', async () => {
    installBrowserPushEnvironment({
      permission: 'default',
      permissionResult: 'granted',
      subscription: null,
    });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');

    await act(async () => {
      await expect(result.current.subscribe()).rejects.toThrow(
        'components.pushNotifications.errors.vapidMissing'
      );
    });
  });

  it('uses fallback messages for non-Error refresh, subscribe, and unsubscribe failures', async () => {
    const browser = installBrowserPushEnvironment();
    mocks.pushApiFetch.mockRejectedValueOnce('refresh failure');
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() =>
      expect(result.current.error).toBe('components.pushNotifications.errors.changeFailed')
    );

    mocks.pushApiFetch.mockRejectedValueOnce('subscribe failure');
    await act(async () => {
      await expect(result.current.subscribe()).rejects.toBe('subscribe failure');
    });
    expect(result.current.error).toBe('components.pushNotifications.errors.subscribeFailed');

    browser.subscription!.unsubscribe = vi.fn().mockRejectedValueOnce('unsubscribe failure');
    await act(async () => {
      await expect(result.current.unsubscribe()).rejects.toBe('unsubscribe failure');
    });
    expect(result.current.error).toBe('components.pushNotifications.errors.unsubscribeFailed');

    browser.subscription!.unsubscribe = vi
      .fn()
      .mockRejectedValueOnce(new Error('unsubscribe error'));
    await act(async () => {
      await expect(result.current.unsubscribe()).rejects.toThrow('unsubscribe error');
    });
    expect(result.current.error).toBe('unsubscribe error');
  });

  it('unregisters a server device even when no browser subscription exists', async () => {
    const browser = installBrowserPushEnvironment();
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    browser.pushManager.getSubscription.mockResolvedValueOnce(null);
    mocks.pushApiFetch.mockClear();

    await act(async () => result.current.unsubscribe());

    expect(mocks.pushApiFetch).toHaveBeenCalledWith(
      '/api/push/subscription',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('ignores stale success, absence, and error results from overlapping refreshes', async () => {
    const browser = installBrowserPushEnvironment();
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    function deferredRegistration() {
      let resolve!: (value: ServiceWorkerRegistration) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<ServiceWorkerRegistration>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    }

    async function overtake(settle: (pending: ReturnType<typeof deferredRegistration>) => void) {
      const pending = deferredRegistration();
      browser.serviceWorker.getRegistration
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce(browser.registration);
      let stale!: Promise<void>;
      let latest!: Promise<void>;
      act(() => {
        stale = result.current.refresh();
        latest = result.current.refresh();
      });
      await act(async () => latest);
      settle(pending);
      await act(async () => stale);
    }

    await overtake(pending => pending.resolve(browser.registration));

    const noSubscriptionRegistration = {
      active: {},
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ServiceWorkerRegistration;
    await overtake(pending => pending.resolve(noSubscriptionRegistration));
    await overtake(pending => pending.reject('stale failure'));

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('refreshes on focus only while the document is visible', async () => {
    installBrowserPushEnvironment();
    const { result, unmount } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    mocks.pushApiFetch.mockClear();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(mocks.pushApiFetch).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(mocks.pushApiFetch).toHaveBeenCalledOnce());
    unmount();
  });

  it('times out while waiting for service worker activation', async () => {
    vi.useFakeTimers();
    const browser = installBrowserPushEnvironment({ permission: 'granted', subscription: null });
    browser.serviceWorker.getRegistration
      .mockResolvedValueOnce(browser.registration)
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(browser.serviceWorker, 'ready', {
      configurable: true,
      value: new Promise(() => undefined),
    });
    const { result } = renderHook(() => usePushSubscription());
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    mocks.pushApiFetch.mockClear();

    const rejectedSubscription = expect(result.current.subscribe()).rejects.toThrow(
      'Service worker activation timed out'
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await rejectedSubscription;
  });
});
