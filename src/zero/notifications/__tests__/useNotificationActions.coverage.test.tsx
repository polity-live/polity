/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const names = [
    'setNotificationRead',
    'setAllNotificationsRead',
    'markRead',
    'markAllRead',
    'dismissNotification',
    'restoreNotification',
    'purgeNotificationForUser',
    'deleteEntityNotificationGlobally',
    'restoreEntityNotificationGlobally',
    'createEntityNotification',
    'updateEntityNotification',
    'delete',
    'updateSettings',
    'createSettings',
    'registerPushSubscription',
    'unregisterPushSubscription',
    'markEntityNotificationRead',
    'markAllEntityNotificationsRead',
  ];
  const mutators = Object.fromEntries(
    names.map(name => [name, vi.fn((args: unknown) => ({ name, args }))])
  ) as Record<string, ReturnType<typeof vi.fn>>;
  const mutationResult = {
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  };
  return {
    mutators,
    mutationResult,
    mutate: vi.fn(() => mutationResult),
    onServerError: vi.fn(),
    trackServerFinalization: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { notifications: mocks.mutators } }));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => mocks.onServerError(...args),
  trackServerFinalization: (...args: unknown[]) => mocks.trackServerFinalization(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutate.mockReturnValue(mocks.mutationResult);
});

afterEach(cleanup);

describe('useNotificationActions complete command surface', () => {
  it('dispatches every command and wires all success and failure feedback', () => {
    const { result } = renderHook(() => useNotificationActions());
    const args = { id: 'notification-1', notificationId: 'notification-1', read: true } as never;

    act(() => {
      result.current.setNotificationRead(args);
      result.current.setAllNotificationsRead({ scope: { kind: 'inbox' }, read: true });
      result.current.setAllNotificationsRead({ scope: { kind: 'inbox' }, read: false });
      result.current.markRead(args);
      result.current.markAllRead(args);
      result.current.dismissNotification(args);
      result.current.restoreNotification(args);
      result.current.purgeNotificationForUser(args);
      result.current.deleteEntityNotificationGlobally(args);
      result.current.restoreEntityNotificationGlobally(args);
      result.current.createEntityNotification(args);
      result.current.updateEntityNotification(args);
      result.current.deleteNotification(args);
      result.current.updateSettings(args);
      result.current.createSettings(args);
      result.current.registerPushSubscription(args);
      result.current.unregisterPushSubscription(args);
      result.current.markEntityNotificationRead(args);
      result.current.markAllEntityNotificationsRead(args);
    });

    expect(mocks.mutate).toHaveBeenCalledTimes(19);
    for (const callback of mocks.onServerError.mock.calls.map(call => call[1])) {
      callback('server failure');
    }
    for (const [, callbacks] of mocks.trackServerFinalization.mock.calls) {
      callbacks.onSuccess();
      callbacks.onError('server failure');
    }

    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.notifications.toasts.allMarkedRead');
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'features.notifications.toasts.allMarkedUnread'
    );
    expect(mocks.toastError).toHaveBeenCalled();
  });
});
