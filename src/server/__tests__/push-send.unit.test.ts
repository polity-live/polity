import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preference: { language: 'en' } as any,
  subscriptions: [] as any[],
  deletedIds: [] as string[],
  deleteError: null as Error | null,
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  localize: vi.fn((copy: string, language: string): string | null => `${language}:${copy}`),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (handler: (input: any) => unknown) => handler,
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'user_preference') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mocks.preference }) }),
          }),
        };
      }
      if (table === 'push_subscription') {
        return {
          select: () => ({ eq: async () => ({ data: mocks.subscriptions }) }),
          delete: () => ({
            eq: async (_column: string, id: string) => {
              if (mocks.deleteError) throw mocks.deleteError;
              mocks.deletedIds.push(id);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));
vi.mock('web-push', () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails,
  },
}));
vi.mock('@/features/notifications/logic/localizeNotificationCopy', () => ({
  localizeNotificationCopy: mocks.localize,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { pushHealthCheckFn, sendPushNotificationToUser } from '../push-send';

const notification = {
  title: 'notification.title',
  message: 'notification.message',
  type: 'invite',
  actionUrl: '/invitations',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preference = { language: 'en' };
  mocks.subscriptions = [];
  mocks.deletedIds = [];
  mocks.deleteError = null;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_EMAIL;
  process.env.SUPABASE_URL = 'https://supabase.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  mocks.sendNotification.mockResolvedValue(undefined);
});

describe('push notification server boundary', () => {
  it('returns deterministic no-subscription and unconfigured outcomes without sending', async () => {
    await expect(sendPushNotificationToUser('user-1', notification)).resolves.toEqual({
      message: 'generated.inline.0680_no_subscriptions_found_6f645f78',
      sent: 0,
      failed: 0,
    });
    mocks.subscriptions = [
      { id: 'subscription-1', endpoint: 'https://push.test/1', auth: 'auth', p256dh: 'key' },
    ];
    await expect(sendPushNotificationToUser('user-1', notification)).resolves.toEqual({
      message: 'push_not_configured',
      sent: 0,
      failed: 0,
    });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('localizes payloads, counts every delivery, and removes expired subscriptions', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key-12345678901234567890';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_EMAIL = 'mailto:push@example.test';
    mocks.preference = { language: 'de' };
    mocks.subscriptions = [
      { id: 'subscription-1', endpoint: 'https://push.test/1', auth: 'auth-1', p256dh: 'key-1' },
      { id: 'subscription-2', endpoint: 'https://push.test/2', auth: 'auth-2', p256dh: 'key-2' },
    ];
    mocks.sendNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('expired'), { statusCode: 410 }));

    await expect(sendPushNotificationToUser('user-1', notification)).resolves.toEqual({
      message: 'generated.inline.0681_push_notifications_sent_adb2827e',
      sent: 1,
      failed: 1,
      total: 2,
    });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      'mailto:push@example.test',
      'public-key-12345678901234567890',
      'private-key'
    );
    const payload = JSON.parse(mocks.sendNotification.mock.calls[0][1]);
    expect(payload).toMatchObject({
      title: 'de:notification.title',
      body: 'de:notification.message',
      actionUrl: '/invitations',
      language: 'de',
    });
    expect(mocks.deletedIds).toEqual(['subscription-2']);
  });

  it('uses payload and VAPID defaults and preserves explicit presentation options', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    mocks.preference = null;
    mocks.subscriptions = [
      { id: 'subscription-1', endpoint: 'https://push.test/1', auth: 'auth', p256dh: 'key' },
    ];
    mocks.localize.mockReturnValueOnce(null).mockReturnValueOnce(null);

    await sendPushNotificationToUser('user-1', {
      title: 'Fallback title',
      message: 'Fallback message',
      tag: 'explicit-tag',
      icon: '/icon.png',
      badge: '/badge.png',
      requireInteraction: true,
      actions: [{ action: 'open', title: 'Open', icon: '/action.png' }],
    });

    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      'mailto:your-email@example.com',
      'public-key',
      'private-key'
    );
    expect(JSON.parse(mocks.sendNotification.mock.calls[0][1])).toMatchObject({
      title: 'Fallback title',
      message: 'Fallback message',
      tag: 'explicit-tag',
      icon: '/icon.png',
      badge: '/badge.png',
      requireInteraction: true,
      actions: [{ action: 'open', title: 'Open', icon: '/action.png' }],
      language: 'en',
    });

    mocks.localize.mockImplementation((copy: string, language: string) => `${language}:${copy}`);
    await sendPushNotificationToUser('user-1', {
      title: 'No tag',
      message: 'No tag message',
    });
    expect(JSON.parse(mocks.sendNotification.mock.calls[1][1]).tag).toBe('notification');
  });

  it('handles 404 cleanup failures and ordinary delivery failures', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    mocks.subscriptions = [
      { id: 'subscription-1', endpoint: 'https://push.test/1', auth: 'auth', p256dh: 'key' },
      { id: 'subscription-2', endpoint: 'https://push.test/2', auth: 'auth', p256dh: 'key' },
    ];
    mocks.deleteError = new Error('cleanup failed');
    mocks.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { statusCode: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('bad request'), { statusCode: 400 }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(sendPushNotificationToUser('user-1', notification)).resolves.toMatchObject({
      sent: 0,
      failed: 2,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[Push API] Failed to delete subscription subscription-1:',
      mocks.deleteError
    );
    errorSpy.mockRestore();
  });

  it('wraps each missing Supabase credential', async () => {
    delete process.env.SUPABASE_URL;
    await expect(sendPushNotificationToUser('user-1', notification)).rejects.toThrow(
      'Failed to send push notifications'
    );

    process.env.SUPABASE_URL = 'https://supabase.example.test';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(sendPushNotificationToUser('user-1', notification)).rejects.toThrow(
      'Failed to send push notifications'
    );
  });

  it('reports health without exposing the complete key and rejects invalid requests', async () => {
    await expect((pushHealthCheckFn as any)()).resolves.toEqual({
      status: 'ok',
      pushNotificationsEnabled: false,
      vapidPublicKey: 'Not configured',
    });
    process.env.VAPID_PUBLIC_KEY = '1234567890123456789012345';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    await expect((pushHealthCheckFn as any)()).resolves.toEqual({
      status: 'ok',
      pushNotificationsEnabled: true,
      vapidPublicKey: '12345678901234567890...',
    });
    await expect(sendPushNotificationToUser('', notification)).rejects.toThrow();
  });
});
