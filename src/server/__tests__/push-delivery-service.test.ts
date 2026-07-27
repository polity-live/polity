import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  authorizePushDelivery,
  buildDirectPushPayload,
  buildPushTestPayload,
  executePushDelivery,
  isPushNotificationEnabled,
  isRetryablePushStatus,
  PushDeliveryHttpError,
  pushRetryDelayMs,
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
  });

  it('retries network, rate-limit, and server errors only', () => {
    expect(isRetryablePushStatus(undefined)).toBe(true);
    expect(isRetryablePushStatus(429)).toBe(true);
    expect(isRetryablePushStatus(503)).toBe(true);
    expect(isRetryablePushStatus(400)).toBe(false);
    expect(isRetryablePushStatus(410)).toBe(false);
  });

  it('uses capped exponential retry delays', () => {
    expect(pushRetryDelayMs(1)).toBe(60_000);
    expect(pushRetryDelayMs(2)).toBe(120_000);
    expect(pushRetryDelayMs(8)).toBe(3_600_000);
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
});
