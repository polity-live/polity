import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryResults: [] as Record<string, any>[],
  rpcResults: [] as Record<string, any>[],
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  createClient: vi.fn(),
}));

function client() {
  return {
    from: vi.fn(() => {
      const query: any = {};
      for (const method of ['select', 'insert', 'update', 'delete', 'eq']) {
        query[method] = vi.fn(() => query);
      }
      const next = async () => mocks.queryResults.shift() ?? { data: null, error: null };
      query.maybeSingle = vi.fn(next);
      query.single = vi.fn(next);
      query.then = (resolve: (value: unknown) => unknown) => next().then(resolve);
      return query;
    }),
    rpc: vi.fn(async () => mocks.rpcResults.shift() ?? { data: [], error: null }),
  } as any;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));
vi.mock('web-push', () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails,
  },
}));

import {
  enqueueDirectPushDelivery,
  executePushDelivery,
  getPushTestStatus,
  processPushTest,
  schedulePushTest,
} from '../push-delivery-service';

const status = {
  id: 9,
  status: 'pending',
  skip_reason: null,
  last_error: null,
  available_at: 'scheduled',
  completed_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryResults = [];
  mocks.rpcResults = [];
  mocks.createClient.mockImplementation(() => client());
  mocks.sendNotification.mockResolvedValue(undefined);
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.PUSH_DELIVERY_ENABLED = 'true';
  process.env.VAPID_PUBLIC_KEY = 'public';
  process.env.VAPID_PRIVATE_KEY = 'private';
  delete process.env.VAPID_EMAIL;
});

describe('push delivery default dependencies', () => {
  it('uses the environment-backed worker and web-push sender', async () => {
    mocks.rpcResults = [
      { data: [], error: null },
      {
        data: [
          {
            id: 1,
            notification_id: 'notification-a',
            user_id: 'user-a',
            push_subscription_id: 'subscription-a',
            kind: 'notification',
            payload: { title: 'Title', message: 'Message' },
            status: 'processing',
            attempt_count: 1,
          },
        ],
        error: null,
      },
    ];
    mocks.queryResults = [
      {
        data: {
          id: 'subscription-a',
          user_id: 'user-a',
          endpoint: 'https://push.test/one',
          auth: 'auth',
          p256dh: 'key',
        },
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
      { error: null },
    ];

    await expect(executePushDelivery()).resolves.toMatchObject({ sent: 1 });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      'mailto:support@polity.live',
      'public',
      'private'
    );
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('uses default clients and identifiers for direct and test-job operations', async () => {
    mocks.rpcResults = [{ data: 2, error: null }];
    await expect(
      enqueueDirectPushDelivery('user-a', 'notification-a', {
        title: 'Title',
        message: 'Message',
      })
    ).resolves.toBe(2);

    mocks.queryResults = [
      { data: { id: 'subscription-a' }, error: null },
      { data: status, error: null },
    ];
    await expect(
      schedulePushTest('user-a', 'device-a', { title: 'Test', message: 'Message' })
    ).resolves.toMatchObject({ jobId: '9', status: 'pending' });

    mocks.queryResults = [{ data: status, error: null }];
    await expect(getPushTestStatus('user-a', '9')).resolves.toMatchObject({ jobId: '9' });

    mocks.queryResults = [
      { data: status, error: null },
      { data: status, error: null },
    ];
    mocks.rpcResults = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    await expect(processPushTest('user-a', '9')).resolves.toMatchObject({ jobId: '9' });
  });
});
