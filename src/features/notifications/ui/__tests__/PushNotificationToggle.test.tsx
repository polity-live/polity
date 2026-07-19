/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  pushState: {
    isSupported: true,
    isSubscribed: false,
    isLoading: false,
    permission: 'granted' as NotificationPermission,
    error: null as string | null,
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

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'components.pushNotifications.activate': 'Activate notifications',
        'components.pushNotifications.active': 'Notifications active',
        'components.pushNotifications.activated': 'Push notifications enabled',
        'components.pushNotifications.deactivated': 'Push notifications disabled',
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
    mocks.subscribe.mockResolvedValue(undefined);
    mocks.unsubscribe.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

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
});
