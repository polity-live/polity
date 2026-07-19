/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mutationResult = {
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' as const }),
  };

  return {
    mutationResult,
    zeroMutate: vi.fn(() => mutationResult),
    onServerError: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    registerPushSubscription: vi.fn((args: unknown) => ({ type: 'register', args })),
    unregisterPushSubscription: vi.fn((args: unknown) => ({ type: 'unregister', args })),
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.zeroMutate }),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    notifications: {
      registerPushSubscription: mocks.registerPushSubscription,
      unregisterPushSubscription: mocks.unregisterPushSubscription,
    },
  },
}));

vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => mocks.onServerError(...args),
  trackServerFinalization: vi.fn(),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useNotificationActions } from '../useNotificationActions';

describe('useNotificationActions push subscription toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.zeroMutate.mockReturnValue(mocks.mutationResult);
  });

  afterEach(cleanup);

  it('leaves successful push registration feedback to the push toggle', () => {
    const { result } = renderHook(() => useNotificationActions());
    const args = {
      id: 'subscription-1',
      endpoint: 'https://push.example/subscription-1',
      auth: 'auth',
      p256dh: 'p256dh',
      user_agent: 'test',
    };

    act(() => {
      result.current.registerPushSubscription(args);
    });

    expect(mocks.registerPushSubscription).toHaveBeenCalledWith(args);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.onServerError).toHaveBeenCalledOnce();
  });

  it('does not emit one success toast per removed subscription', () => {
    const { result } = renderHook(() => useNotificationActions());

    act(() => {
      result.current.unregisterPushSubscription({ id: 'subscription-1' });
      result.current.unregisterPushSubscription({ id: 'subscription-2' });
    });

    expect(mocks.unregisterPushSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.onServerError).toHaveBeenCalledTimes(2);
  });

  it('keeps the mutation error toast for failed push changes', () => {
    const { result } = renderHook(() => useNotificationActions());

    act(() => {
      result.current.registerPushSubscription({
        id: 'subscription-1',
        endpoint: 'https://push.example/subscription-1',
        auth: 'auth',
        p256dh: 'p256dh',
        user_agent: 'test',
      });
      result.current.unregisterPushSubscription({ id: 'subscription-2' });
    });

    const errorCallbacks = mocks.onServerError.mock.calls.map(call => call[1] as () => void);
    errorCallbacks.forEach(callback => callback());

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenNthCalledWith(
      1,
      'features.notifications.toasts.pushEnableFailed'
    );
    expect(mocks.toastError).toHaveBeenNthCalledWith(
      2,
      'features.notifications.toasts.pushDisableFailed'
    );
  });
});
