import { afterEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';

import {
  authorizePushDelivery,
  buildDirectPushPayload,
  buildPushTestPayload,
  enqueueDirectPushDelivery,
  executePushDelivery,
  getPushTestStatus,
  isPushNotificationEnabled,
  isRetryablePushStatus,
  processPushTest,
  PushDeliveryHttpError,
  pushDeliveryContracts,
  pushRetryDelayMs,
  schedulePushTest,
} from '../push-delivery-service';

const originalSecret = process.env.PUSH_DELIVERY_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.PUSH_DELIVERY_SECRET;
  else process.env.PUSH_DELIVERY_SECRET = originalSecret;
});

type WorkerRow = Record<string, any>;

function createWorkerFixture({
  jobs,
  subscriptions,
  settings = [],
  preferences = [],
}: {
  jobs: WorkerRow[];
  subscriptions: WorkerRow[];
  settings?: WorkerRow[];
  preferences?: WorkerRow[];
}) {
  const tables: Record<string, WorkerRow[]> = {
    push_subscription: structuredClone(subscriptions),
    notification_setting: structuredClone(settings),
    user_preference: structuredClone(preferences),
    push_delivery_outbox: structuredClone(jobs),
  };

  class Query {
    private operation: 'select' | 'update' | 'delete' = 'select';
    private filters: ((row: WorkerRow) => boolean)[] = [];
    private values: WorkerRow = {};
    private resultLimit: number | null = null;

    constructor(private readonly tableName: string) {}

    select() {
      return this;
    }

    update(values: WorkerRow) {
      this.operation = 'update';
      this.values = values;
      return this;
    }

    delete() {
      this.operation = 'delete';
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push(row => row[column] === value);
      return this;
    }

    limit(value: number) {
      this.resultLimit = value;
      return this;
    }

    private matchingRows() {
      const rows = tables[this.tableName].filter(row => this.filters.every(filter => filter(row)));
      return this.resultLimit === null ? rows : rows.slice(0, this.resultLimit);
    }

    private async execute() {
      if (this.operation === 'update') {
        const rows = this.matchingRows();
        rows.forEach(row => Object.assign(row, structuredClone(this.values)));
        return { data: structuredClone(rows), error: null };
      }
      if (this.operation === 'delete') {
        const matches = new Set(this.matchingRows());
        tables[this.tableName] = tables[this.tableName].filter(row => !matches.has(row));
        return { data: null, error: null };
      }
      return { data: structuredClone(this.matchingRows()), error: null };
    }

    async maybeSingle() {
      const result = await this.execute();
      return { ...result, data: result.data?.[0] ?? null };
    }

    then(resolve: (value: any) => unknown, reject: (error: unknown) => unknown) {
      return this.execute().then(resolve, reject);
    }
  }

  return {
    tables,
    client: {
      from(tableName: string) {
        return new Query(tableName);
      },
      async rpc(name: string) {
        if (name === 'claim_push_notification_jobs') return { data: [], error: null };
        if (name === 'claim_push_delivery_jobs') {
          return { data: structuredClone(jobs), error: null };
        }
        throw new Error(`Unexpected RPC: ${name}`);
      },
    } as any,
  };
}

function scriptedClient(
  queryResults: Record<string, any>[] = [],
  rpcResults: Record<string, any>[] = []
) {
  const queryQueue = [...queryResults];
  const rpcQueue = [...rpcResults];
  return {
    from: vi.fn(() => {
      const query: any = {};
      for (const method of ['select', 'insert', 'update', 'delete', 'eq']) {
        query[method] = vi.fn(() => query);
      }
      const next = async () => queryQueue.shift() ?? { data: null, error: null };
      query.maybeSingle = vi.fn(next);
      query.single = vi.fn(next);
      query.then = (resolve: (value: unknown) => unknown) => next().then(resolve);
      return query;
    }),
    rpc: vi.fn(async () => rpcQueue.shift() ?? { data: [], error: null }),
  } as any;
}

function deliveryJob(id: number, subscriptionId: string, userId = 'user-a') {
  return {
    id,
    notification_id: 'notification-a',
    user_id: userId,
    push_subscription_id: subscriptionId,
    kind: 'notification',
    payload: {
      title: 'Push',
      message: 'Message',
      type: 'system_notification',
      foregroundBehavior: 'toast',
    },
    status: 'processing',
    attempt_count: 1,
  };
}

function subscription(id: string, userId = 'user-a') {
  return {
    id,
    user_id: userId,
    endpoint: `https://push.test/${id}`,
    auth: 'auth-key',
    p256dh: 'p256dh-key',
  };
}

const enabledWorkerConfig = {
  enabled: true,
  publicKey: 'test-public',
  privateKey: 'test-private',
};

describe('push delivery policy', () => {
  it('honors the global push switch and notification type setting', () => {
    expect(
      isPushNotificationEnabled('group_new_event', {
        delivery_settings: { pushNotifications: false },
        group_notifications: { newEvents: true },
      })
    ).toBe(false);
    expect(
      isPushNotificationEnabled('group_new_event', {
        delivery_settings: { pushNotifications: true },
        group_notifications: { newEvents: false },
      })
    ).toBe(false);
    expect(
      isPushNotificationEnabled('group_new_event', {
        delivery_settings: { pushNotifications: true },
        group_notifications: { newEvents: true },
      })
    ).toBe(true);
    expect(isPushNotificationEnabled('system_notification', null)).toBe(true);
    expect(isPushNotificationEnabled(undefined, null)).toBe(true);
    expect(
      isPushNotificationEnabled('group_new_event', {
        delivery_settings: { pushNotifications: true },
      })
    ).toBe(true);
  });

  it('retries network, rate-limit, and server errors only', () => {
    expect(isRetryablePushStatus(undefined)).toBe(true);
    expect(isRetryablePushStatus(429)).toBe(true);
    expect(isRetryablePushStatus(503)).toBe(true);
    expect(isRetryablePushStatus(400)).toBe(false);
    expect(isRetryablePushStatus(410)).toBe(false);
  });

  it('uses capped exponential retry delays', () => {
    expect(pushRetryDelayMs(0)).toBe(60_000);
    expect(pushRetryDelayMs(1)).toBe(60_000);
    expect(pushRetryDelayMs(2)).toBe(120_000);
    expect(pushRetryDelayMs(8)).toBe(3_600_000);
  });

  it('reads configuration, validates Supabase and VAPID, and formats arbitrary errors', () => {
    const original = {
      enabled: process.env.PUSH_DELIVERY_ENABLED,
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      email: process.env.VAPID_EMAIL,
      url: process.env.SUPABASE_URL,
      role: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    try {
      vi.stubEnv('PUSH_DELIVERY_ENABLED', ' TRUE ');
      vi.stubEnv('VAPID_PUBLIC_KEY', ' public ');
      vi.stubEnv('VAPID_PRIVATE_KEY', ' private ');
      vi.stubEnv('VAPID_EMAIL', ' mailto:test@example.test ');
      expect(pushDeliveryContracts.readConfig()).toEqual({
        enabled: true,
        publicKey: 'public',
        privateKey: 'private',
        email: 'mailto:test@example.test',
      });
      expect(() =>
        pushDeliveryContracts.initVapid({
          enabled: true,
          publicKey: '',
          privateKey: '',
          email: 'mailto:test@example.test',
        })
      ).toThrow('Missing VAPID configuration');
      expect(() =>
        pushDeliveryContracts.initVapid({
          enabled: true,
          publicKey: 'public',
          privateKey: '',
          email: 'mailto:test@example.test',
        })
      ).toThrow('Missing VAPID configuration');
      const vapidSpy = vi.spyOn(webpush, 'setVapidDetails').mockImplementation(() => undefined);
      pushDeliveryContracts.initVapid({
        enabled: true,
        publicKey: 'public',
        privateKey: 'private',
        email: 'mailto:test@example.test',
      });
      expect(vapidSpy).toHaveBeenCalledWith('mailto:test@example.test', 'public', 'private');
      vapidSpy.mockRestore();
      expect(pushDeliveryContracts.message('plain failure')).toBe('plain failure');
      expect(pushDeliveryContracts.message(new Error('error failure'))).toBe('error failure');

      vi.stubEnv('SUPABASE_URL', '');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      expect(() => pushDeliveryContracts.getSupabase()).toThrow('Missing Supabase configuration');
      vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
      expect(() => pushDeliveryContracts.getSupabase()).toThrow('Missing Supabase configuration');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
      expect(pushDeliveryContracts.getSupabase()).toBeDefined();
    } finally {
      for (const [key, value] of Object.entries({
        PUSH_DELIVERY_ENABLED: original.enabled,
        VAPID_PUBLIC_KEY: original.publicKey,
        VAPID_PRIVATE_KEY: original.privateKey,
        VAPID_EMAIL: original.email,
        SUPABASE_URL: original.url,
        SUPABASE_SERVICE_ROLE_KEY: original.role,
      })) {
        if (value === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = value;
      }
    }
  });

  it('does not touch delivery dependencies while disabled', async () => {
    await expect(executePushDelivery({}, { config: { enabled: false } })).resolves.toMatchObject({
      disabled: true,
      claimed: 0,
      sent: 0,
    });
  });

  it('marks direct and test pushes as foreground system notifications', () => {
    expect(
      buildDirectPushPayload('notification-a', {
        title: 'Push only',
        message: 'No in-app copy',
        actionUrl: '/notifications',
        type: 'system_notification',
      })
    ).toMatchObject({
      notificationId: 'notification-a',
      foregroundBehavior: 'system',
    });
    expect(
      buildPushTestPayload('test-a', {
        title: 'Push test',
        message: 'Delivery test',
      })
    ).toMatchObject({
      tag: 'push-test:test-a',
      foregroundBehavior: 'system',
    });
  });
});

describe('push worker authorization', () => {
  it('accepts the configured bearer secret', () => {
    process.env.PUSH_DELIVERY_SECRET = 'test-secret';
    expect(() =>
      authorizePushDelivery(
        new Request('https://www.polity.live/api/push/process', {
          headers: { Authorization: 'Bearer test-secret' },
        })
      )
    ).not.toThrow();
  });

  it('rejects missing and invalid bearer secrets', () => {
    process.env.PUSH_DELIVERY_SECRET = 'test-secret';
    expect(() =>
      authorizePushDelivery(new Request('https://www.polity.live/api/push/process'))
    ).toThrow(PushDeliveryHttpError);
    expect(() =>
      authorizePushDelivery(
        new Request('https://www.polity.live/api/push/process', {
          headers: { Authorization: 'Bearer wrong-secret' },
        })
      )
    ).toThrow('Unauthorized');
    delete process.env.PUSH_DELIVERY_SECRET;
    expect(() =>
      authorizePushDelivery(new Request('https://www.polity.live/api/push/process'))
    ).toThrow('Unauthorized');
  });
});

describe('push delivery worker', () => {
  it('sends to every subscribed device without consulting client presence', async () => {
    const jobs = [deliveryJob(1, 'subscription-a'), deliveryJob(2, 'subscription-b')];
    const fixture = createWorkerFixture({
      jobs,
      subscriptions: [subscription('subscription-a'), subscription('subscription-b')],
      preferences: [{ user_id: 'user-a', language: 'de' }],
    });
    const sendNotification = vi.fn().mockResolvedValue(undefined);

    const result = await executePushDelivery(
      { notificationId: 'notification-a' },
      {
        supabase: fixture.client,
        config: enabledWorkerConfig,
        initializeVapid: vi.fn(),
        sendNotification,
      }
    );

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({
      foregroundBehavior: 'toast',
      language: 'de',
    });
    expect(result.sent).toBe(2);
    expect(fixture.tables.push_delivery_outbox.every(row => row.status === 'sent')).toBe(true);
  });

  it('returns transient failures to pending with exponential backoff', async () => {
    const job = deliveryJob(1, 'subscription-a');
    const fixture = createWorkerFixture({
      jobs: [job],
      subscriptions: [subscription('subscription-a')],
    });
    const sendNotification = vi.fn().mockRejectedValue({
      statusCode: 503,
      message: 'Temporary push service failure',
    });

    const result = await executePushDelivery(
      { notificationId: 'notification-a' },
      {
        supabase: fixture.client,
        config: enabledWorkerConfig,
        initializeVapid: vi.fn(),
        sendNotification,
      }
    );

    expect(result.retried).toBe(1);
    expect(fixture.tables.push_delivery_outbox[0]).toMatchObject({
      status: 'pending',
      last_error: '[object Object]',
      locked_at: null,
    });
    expect(Date.parse(fixture.tables.push_delivery_outbox[0].available_at)).toBeGreaterThan(
      Date.now()
    );
  });

  it('removes expired 404/410 subscriptions and skips their job', async () => {
    const job = deliveryJob(1, 'subscription-a');
    const fixture = createWorkerFixture({
      jobs: [job],
      subscriptions: [subscription('subscription-a')],
    });
    const sendNotification = vi.fn().mockRejectedValue({
      statusCode: 410,
      message: 'Gone',
    });

    const result = await executePushDelivery(
      { notificationId: 'notification-a' },
      {
        supabase: fixture.client,
        config: enabledWorkerConfig,
        initializeVapid: vi.fn(),
        sendNotification,
      }
    );

    expect(result.removedSubscriptions).toBe(1);
    expect(fixture.tables.push_subscription).toHaveLength(0);
    expect(fixture.tables.push_delivery_outbox[0]).toMatchObject({
      status: 'skipped',
      skip_reason: 'subscription_expired',
    });
  });

  it('skips missing subscriptions and disabled notification categories', async () => {
    const jobs = [deliveryJob(1, ''), deliveryJob(2, 'subscription-a')];
    const fixture = createWorkerFixture({
      jobs,
      subscriptions: [subscription('subscription-a')],
      settings: [
        {
          user_id: 'user-a',
          delivery_settings: { pushNotifications: false },
        },
      ],
    });

    const result = await executePushDelivery(
      { limit: 1000 },
      {
        supabase: fixture.client,
        config: enabledWorkerConfig,
        initializeVapid: vi.fn(),
        sendNotification: vi.fn(),
      }
    );
    expect(result).toMatchObject({ claimed: 2, skipped: 2 });
  });

  it('marks terminal and non-retryable delivery failures as failed', async () => {
    for (const job of [
      { ...deliveryJob(1, 'subscription-a'), attempt_count: 8 },
      deliveryJob(2, 'subscription-a'),
    ]) {
      const fixture = createWorkerFixture({
        jobs: [job],
        subscriptions: [subscription('subscription-a')],
      });
      const sendNotification = vi
        .fn()
        .mockRejectedValue(
          job.attempt_count === 8
            ? Object.assign(new Error('still unavailable'), { statusCode: 503 })
            : Object.assign(new Error('invalid'), { statusCode: 400 })
        );
      const result = await executePushDelivery(
        { limit: 0 },
        {
          supabase: fixture.client,
          config: enabledWorkerConfig,
          initializeVapid: vi.fn(),
          sendNotification,
        }
      );
      expect(result.failed).toBe(1);
      expect(fixture.tables.push_delivery_outbox[0].status).toBe('failed');
    }
  });

  it('surfaces claim errors and handles empty claim responses', async () => {
    await expect(
      executePushDelivery(
        {},
        {
          supabase: scriptedClient([], [{ error: { message: 'notification claim' } }]),
          config: enabledWorkerConfig,
          initializeVapid: vi.fn(),
          sendNotification: vi.fn(),
        }
      )
    ).rejects.toThrow('notification claim');
    await expect(
      executePushDelivery(
        {},
        {
          supabase: scriptedClient(
            [],
            [{ data: null, error: null }, { error: { message: 'delivery claim' } }]
          ),
          config: enabledWorkerConfig,
          initializeVapid: vi.fn(),
          sendNotification: vi.fn(),
        }
      )
    ).rejects.toThrow('delivery claim');
    await expect(
      executePushDelivery(
        { deliveryId: '4' },
        {
          supabase: scriptedClient(
            [],
            [
              { data: null, error: null },
              { data: null, error: null },
            ]
          ),
          config: enabledWorkerConfig,
          initializeVapid: vi.fn(),
          sendNotification: vi.fn(),
        }
      )
    ).resolves.toMatchObject({ claimed: 0 });
  });

  it('expands notification jobs and retries failed audience expansion', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = scriptedClient(
      [{ error: null }],
      [
        {
          data: [
            { id: 1, notification_id: 'notification-a', attempt_count: 1 },
            { id: 2, notification_id: 'notification-b', attempt_count: 8 },
          ],
          error: null,
        },
        { data: null, error: null },
        { error: { message: 'expand failed' } },
        { data: [], error: null },
      ]
    );
    await expect(
      executePushDelivery(
        {},
        {
          supabase,
          config: enabledWorkerConfig,
          initializeVapid: vi.fn(),
          sendNotification: vi.fn(),
        }
      )
    ).resolves.toMatchObject({ expanded: 0 });
    expect(errorSpy).toHaveBeenCalledWith(
      '[PushDelivery] Audience expansion failed:',
      'expand failed'
    );
    errorSpy.mockRestore();
  });

  it('returns unexpected job-processing errors to the retry queue', async () => {
    const job = deliveryJob(1, 'subscription-a');
    const supabase = scriptedClient(
      [
        { error: { message: 'subscription lookup failed' } },
        { data: null, error: null },
        { data: null, error: null },
        { error: null },
      ],
      [
        { data: [], error: null },
        { data: [job], error: null },
      ]
    );
    await expect(
      executePushDelivery(
        {},
        {
          supabase,
          config: enabledWorkerConfig,
          initializeVapid: vi.fn(),
          sendNotification: vi.fn(),
        }
      )
    ).resolves.toMatchObject({ retried: 1 });
  });
});

describe('push delivery contracts and test-job API', () => {
  const directJob = deliveryJob(1, 'subscription-a') as any;

  it('surfaces persistence failures from job state transitions', async () => {
    await expect(
      pushDeliveryContracts.updateJob(
        scriptedClient([{ error: { message: 'update failed' } }]),
        1,
        {
          status: 'sent',
        }
      )
    ).rejects.toThrow('update failed');
    await expect(
      pushDeliveryContracts.failOrRetryJob(
        scriptedClient([{ error: null }]),
        { ...directJob, attempt_count: 8 },
        new Error('terminal'),
        true
      )
    ).resolves.toBe('failed');
    await expect(
      pushDeliveryContracts.failOrRetryJob(
        scriptedClient([{ error: null }]),
        directJob,
        new Error('invalid'),
        false
      )
    ).resolves.toBe('failed');
  });

  it('surfaces each delivery lookup error', async () => {
    for (const results of [
      [
        { error: { message: 'subscription lookup' } },
        { data: null, error: null },
        { data: null, error: null },
      ],
      [
        { data: subscription('subscription-a'), error: null },
        { error: { message: 'settings lookup' } },
        { data: null, error: null },
      ],
      [
        { data: subscription('subscription-a'), error: null },
        { data: null, error: null },
        { error: { message: 'preference lookup' } },
      ],
    ]) {
      await expect(
        pushDeliveryContracts.processDeliveryJob(scriptedClient(results), directJob, vi.fn())
      ).rejects.toThrow('lookup');
    }
  });

  it('skips every invalid subscription shape', async () => {
    for (const invalidSubscription of [
      null,
      subscription('subscription-a', 'user-b'),
      { ...subscription('subscription-a'), auth: '' },
      { ...subscription('subscription-a'), p256dh: '' },
    ]) {
      await expect(
        pushDeliveryContracts.processDeliveryJob(
          scriptedClient([
            { data: invalidSubscription, error: null },
            { data: null, error: null },
            { data: null, error: null },
            { error: null },
          ]),
          directJob,
          vi.fn()
        )
      ).resolves.toBe('skipped');
    }
  });

  it('uses fallback copy and reports expired-subscription cleanup errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      pushDeliveryContracts.processDeliveryJob(
        scriptedClient([
          { data: subscription('subscription-a'), error: null },
          { data: null, error: null },
          { data: { language: 'en' }, error: null },
          { error: null },
        ]),
        { ...directJob, payload: { title: undefined, message: undefined } },
        vi.fn().mockResolvedValue(undefined)
      )
    ).resolves.toBe('sent');

    await expect(
      pushDeliveryContracts.processDeliveryJob(
        scriptedClient([
          { data: subscription('subscription-a'), error: null },
          { data: null, error: null },
          { data: null, error: null },
          { error: null },
          { error: { message: 'cleanup failed' } },
        ]),
        directJob,
        vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 404 }))
      )
    ).resolves.toBe('removed');
    expect(errorSpy).toHaveBeenCalledWith('[PushDelivery] Expired subscription cleanup failed');
    errorSpy.mockRestore();
  });

  it('updates both retrying and exhausted notification jobs', async () => {
    await expect(
      pushDeliveryContracts.retryNotificationJob(
        scriptedClient([{ error: null }]),
        { id: 1, notification_id: 'one', attempt_count: 1 },
        new Error('retry')
      )
    ).resolves.toBeUndefined();
    await expect(
      pushDeliveryContracts.retryNotificationJob(
        scriptedClient([{ error: { message: 'notification update' } }]),
        { id: 2, notification_id: 'two', attempt_count: 8 },
        new Error('terminal')
      )
    ).rejects.toThrow('notification update');
  });

  it('enqueues direct deliveries and schedules, reads, and processes test jobs', async () => {
    await expect(
      enqueueDirectPushDelivery(
        'user-a',
        'notification-a',
        { title: 'Title', message: 'Message' },
        scriptedClient([], [{ data: null, error: null }])
      )
    ).resolves.toBe(0);
    await expect(
      enqueueDirectPushDelivery(
        'user-a',
        'notification-a',
        { title: 'Title', message: 'Message' },
        scriptedClient([], [{ error: { message: 'enqueue failed' } }])
      )
    ).rejects.toThrow('enqueue failed');

    const scheduled = scriptedClient([
      { data: { id: 'subscription-a' }, error: null },
      {
        data: { id: 9, status: 'pending', available_at: '2026-08-09T00:00:00.000Z' },
        error: null,
      },
    ]);
    await expect(
      schedulePushTest(
        'user-a',
        'device-a',
        { title: 'Test', message: 'Message' },
        scheduled,
        () => '00000000-0000-4000-8000-000000000001'
      )
    ).resolves.toEqual({
      jobId: '9',
      status: 'pending',
      scheduledAt: '2026-08-09T00:00:00.000Z',
    });
    await expect(
      schedulePushTest(
        'user-a',
        'device-a',
        { title: 'Test', message: 'Message' },
        scriptedClient([{ error: { message: 'subscription failed' } }])
      )
    ).rejects.toThrow('subscription failed');
    await expect(
      schedulePushTest(
        'user-a',
        'device-a',
        { title: 'Test', message: 'Message' },
        scriptedClient([{ data: null, error: null }])
      )
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      schedulePushTest(
        'user-a',
        'device-a',
        { title: 'Test', message: 'Message' },
        scriptedClient([
          { data: { id: 'subscription-a' }, error: null },
          { error: { message: 'insert failed' } },
        ])
      )
    ).rejects.toThrow('insert failed');

    await expect(getPushTestStatus('user-a', 'invalid', scriptedClient())).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      getPushTestStatus('user-a', '9', scriptedClient([{ error: { message: 'status failed' } }]))
    ).rejects.toThrow('status failed');
    await expect(
      getPushTestStatus('user-a', '9', scriptedClient([{ data: null, error: null }]))
    ).rejects.toMatchObject({ status: 404 });

    const status = {
      id: 9,
      status: 'sent',
      skip_reason: null,
      last_error: null,
      available_at: 'scheduled',
      completed_at: 'completed',
    };
    await expect(
      getPushTestStatus('user-a', '9', scriptedClient([{ data: status, error: null }]))
    ).resolves.toEqual({
      jobId: '9',
      status: 'sent',
      skipReason: null,
      error: null,
      scheduledAt: 'scheduled',
      completedAt: 'completed',
    });

    const execute = vi.fn().mockResolvedValue(undefined);
    await expect(
      processPushTest(
        'user-a',
        '9',
        scriptedClient([
          { data: status, error: null },
          { data: status, error: null },
        ]),
        execute
      )
    ).resolves.toMatchObject({ status: 'sent' });
    expect(execute).toHaveBeenCalledWith({ deliveryId: '9' }, { supabase: expect.anything() });
  });
});
