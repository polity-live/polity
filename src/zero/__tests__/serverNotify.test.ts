import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationHelperMock = vi.fn();

vi.mock('@/features/notifications/utils/notification-helpers.ts', () => ({
  testNotificationHelper: (...args: unknown[]) => notificationHelperMock(...args),
}));

import { fireNotification } from '../server-notify';

describe('fireNotification', () => {
  beforeEach(() => {
    notificationHelperMock.mockReset();
  });

  it('returns a promise that settles after the helper completes', async () => {
    let resolveHelper: (() => void) | undefined;
    notificationHelperMock.mockReturnValueOnce(
      new Promise<void>(resolve => {
        resolveHelper = resolve;
      })
    );

    let dispatchCompleted = false;
    const dispatch = fireNotification('testNotificationHelper', { recipientUserId: 'user-2' }).then(
      () => {
        dispatchCompleted = true;
      }
    );

    expect(notificationHelperMock).toHaveBeenCalledWith({ recipientUserId: 'user-2' });
    expect(dispatchCompleted).toBe(false);

    resolveHelper?.();
    await dispatch;

    expect(dispatchCompleted).toBe(true);
  });

  it('logs helper failures without rejecting the returned promise', async () => {
    const error = new Error('delivery failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    notificationHelperMock.mockRejectedValueOnce(error);

    await expect(
      fireNotification('testNotificationHelper', { recipientUserId: 'user-2' })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      '[ServerNotify]',
      'testNotificationHelper failed:',
      error
    );

    consoleError.mockRestore();
  });
});
