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
  subscription = createSubscription(),
}: {
  permission?: NotificationPermission;
  subscription?: PushSubscription | null;
} = {}) {
  const notification = {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permission),
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
});

afterEach(() => {
  cleanup();
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
});
