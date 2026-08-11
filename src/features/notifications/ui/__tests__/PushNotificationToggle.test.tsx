/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  pushApiFetch: vi.fn(),
  pushState: {
    isSupported: true,
    isSubscribed: false,
    isLoading: false,
    permission: 'granted' as NotificationPermission,
    error: null as string | null,
    deviceId: 'test-device-id',
    serviceWorkerReady: true,
    serverSynchronized: true,
    requiresIosInstall: false,
  },
}));

vi.mock('@/features/pwa/hooks/usePushSubscription.ts', () => ({
  usePushSubscription: () => ({
    ...mocks.pushState,
    subscribe: mocks.subscribe,
    unsubscribe: mocks.unsubscribe,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));

vi.mock('@/features/pwa/push-api', () => ({
  pushApiFetch: (...args: unknown[]) => mocks.pushApiFetch(...args),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'components.pushNotifications.activate': 'Activate notifications',
        'components.pushNotifications.active': 'Notifications active',
        'components.pushNotifications.activated': 'Push notifications enabled',
        'components.pushNotifications.deactivated': 'Push notifications disabled',
        'components.pushNotifications.test.action': 'Send test',
        'components.pushNotifications.test.description': 'Test the push chain.',
        'components.pushNotifications.test.status.pending': 'Test pending',
        'components.pushNotifications.test.status.sent': 'Test sent',
        'components.pushNotifications.test.backgroundInstruction': 'Switch to the background.',
      })[key] ?? key,
  }),
}));

import { PushNotificationToggle } from '../push-notification-toggle';

describe('PushNotificationToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushState.isSubscribed = false;
    mocks.pushState.isLoading = false;
    mocks.pushState.error = null;
    mocks.pushState.isSupported = true;
    mocks.pushState.permission = 'granted';
    mocks.pushState.deviceId = 'test-device-id';
    mocks.pushState.serviceWorkerReady = true;
    mocks.pushState.serverSynchronized = true;
    mocks.pushState.requiresIosInstall = false;
    mocks.subscribe.mockResolvedValue(undefined);
    mocks.unsubscribe.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows exactly one success toast after enabling push notifications', async () => {
    render(<PushNotificationToggle variant="minimal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate notifications' }));
    });

    expect(mocks.subscribe).toHaveBeenCalledOnce();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Push notifications enabled');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('shows exactly one success toast after disabling push notifications', async () => {
    mocks.pushState.isSubscribed = true;
    render(<PushNotificationToggle variant="minimal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notifications active' }));
    });

    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Push notifications disabled');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('shows an error without a success toast when enabling fails', async () => {
    mocks.subscribe.mockRejectedValue(new Error('Subscription failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<PushNotificationToggle variant="minimal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate notifications' }));
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.toastError).toHaveBeenCalledWith('Subscription failed');
  });

  it('shows an error without a success toast when disabling fails', async () => {
    mocks.pushState.isSubscribed = true;
    mocks.unsubscribe.mockRejectedValue(new Error('Unsubscription failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<PushNotificationToggle variant="minimal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notifications active' }));
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.toastError).toHaveBeenCalledWith('Unsubscription failed');
  });

  it('processes a scheduled test after the five-second delay', async () => {
    vi.useFakeTimers();
    mocks.pushState.isSubscribed = true;
    mocks.pushApiFetch
      .mockResolvedValueOnce({ jobId: '42', status: 'pending' })
      .mockResolvedValueOnce({ jobId: '42', status: 'sent' });

    render(<PushNotificationToggle variant="settings" showDiagnostics showDescription />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    });

    expect(mocks.pushApiFetch).toHaveBeenNthCalledWith(1, '/api/push/test', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'test-device-id',
        title: 'components.pushNotifications.test.title',
        message: 'components.pushNotifications.test.message',
      }),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5500);
    });

    expect(mocks.pushApiFetch).toHaveBeenNthCalledWith(2, '/api/push/test/42', {
      method: 'POST',
    });
    expect(screen.getByText('Test sent')).toBeTruthy();
  });

  it('reports structured and unknown subscription failures through localized fallbacks', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.subscribe.mockRejectedValueOnce({
      version: 1,
      code: 'push_operation_failed',
    });
    const { rerender } = render(<PushNotificationToggle variant="minimal" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate notifications' }));
    });
    expect(mocks.toastError).toHaveBeenLastCalledWith('common.appErrors.push_operation_failed');

    mocks.subscribe.mockRejectedValueOnce(42);
    rerender(<PushNotificationToggle variant="minimal" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate notifications' }));
    });
    expect(mocks.toastError).toHaveBeenLastCalledWith('components.pushNotifications.error');
  });

  it('guards test delivery until both a device and subscription exist', async () => {
    mocks.pushState.isSubscribed = true;
    mocks.pushState.deviceId = null as unknown as string;
    const { rerender } = render(<PushNotificationToggle variant="settings" showDiagnostics />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    });
    expect(mocks.pushApiFetch).not.toHaveBeenCalled();

    mocks.pushState.deviceId = 'test-device-id';
    mocks.pushState.isSubscribed = false;
    rerender(<PushNotificationToggle variant="settings" showDiagnostics />);
    const button = screen.getByRole('button', { name: 'Send test' }) as HTMLButtonElement;
    button.disabled = false;
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mocks.pushApiFetch).not.toHaveBeenCalled();
  });

  it('polls pending test jobs again and converts polling failures into failed state', async () => {
    vi.useFakeTimers();
    mocks.pushState.isSubscribed = true;
    mocks.pushApiFetch
      .mockResolvedValueOnce({ jobId: 'pending-job', status: 'pending' })
      .mockResolvedValueOnce({ jobId: 'pending-job', status: 'pending' })
      .mockResolvedValueOnce({ jobId: 'pending-job', status: 'sent' });
    const { unmount } = render(<PushNotificationToggle variant="settings" showDiagnostics />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(mocks.pushApiFetch).toHaveBeenCalledTimes(3);
    unmount();

    mocks.pushApiFetch
      .mockResolvedValueOnce({ jobId: 'failed-job', status: 'pending' })
      .mockRejectedValueOnce({ version: 1, code: 'push_operation_failed' });
    render(<PushNotificationToggle variant="settings" showDiagnostics />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
      await vi.advanceTimersByTimeAsync(5500);
    });
    expect(document.body.textContent).toContain('components.pushNotifications.test.status.failed');
  });

  it('reports scheduling errors and refreshes a visible job with GET', async () => {
    mocks.pushState.isSubscribed = true;
    mocks.pushApiFetch.mockRejectedValueOnce(new Error('schedule failed'));
    const { rerender } = render(<PushNotificationToggle variant="settings" showDiagnostics />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    });
    expect(mocks.toastError).toHaveBeenCalledWith('common.appErrors.unknown');

    mocks.pushApiFetch
      .mockResolvedValueOnce({ jobId: 'visible-job', status: 'pending' })
      .mockResolvedValueOnce({ jobId: 'visible-job', status: 'sent' });
    rerender(<PushNotificationToggle variant="settings" showDiagnostics />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mocks.pushApiFetch).toHaveBeenLastCalledWith('/api/push/test/visible-job', {
      method: 'GET',
    });

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mocks.pushApiFetch).toHaveBeenCalledTimes(3);

    mocks.pushApiFetch.mockRejectedValueOnce(new Error('refresh failed'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mocks.pushApiFetch).toHaveBeenCalledTimes(4);
  });
});
