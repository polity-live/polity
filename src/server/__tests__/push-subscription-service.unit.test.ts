import { describe, expect, it, vi } from 'vitest';

import {
  registerPushSubscriptionForUser,
  unregisterPushSubscriptionForUser,
  PushSubscriptionConflictError,
  pushSubscriptionContracts,
  getPushSubscriptionForDevice,
} from '../push-subscription-service';

type Row = Record<string, any>;

function createSupabaseFixture(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    push_subscription: [],
    notification_setting: [],
    ...structuredClone(initial),
  };

  class Query {
    private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private filters: [string, unknown][] = [];
    private values: Row | Row[] | null = null;
    private countOptions: { count?: string; head?: boolean } | undefined;

    constructor(private readonly tableName: string) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      this.countOptions = options;
      return this;
    }

    insert(values: Row | Row[]) {
      this.operation = 'insert';
      this.values = values;
      return this;
    }

    update(values: Row) {
      this.operation = 'update';
      this.values = values;
      return this;
    }

    delete() {
      this.operation = 'delete';
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }

    private matchingRows() {
      return tables[this.tableName].filter(row =>
        this.filters.every(([column, value]) => row[column] === value)
      );
    }

    private async execute() {
      if (this.operation === 'insert') {
        const inserted = Array.isArray(this.values)
          ? this.values
          : this.values
            ? [this.values]
            : [];
        tables[this.tableName].push(...structuredClone(inserted));
        return { data: structuredClone(inserted), error: null };
      }
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

      const rows = this.matchingRows();
      return {
        data: this.countOptions?.head ? null : structuredClone(rows),
        count: this.countOptions?.count ? rows.length : null,
        error: null,
      };
    }

    async maybeSingle() {
      const result = await this.execute();
      const rows = (result.data ?? []) as Row[];
      return { ...result, data: rows[0] ?? null };
    }

    async single() {
      const result = await this.execute();
      const rows = (result.data ?? []) as Row[];
      return { ...result, data: rows[0] ?? null };
    }

    then(resolve: (value: any) => unknown, reject: (error: unknown) => unknown) {
      return this.execute().then(resolve, reject);
    }
  }

  return {
    tables,
    client: {
      from(tableName: string) {
        if (!tables[tableName]) tables[tableName] = [];
        return new Query(tableName);
      },
    } as any,
  };
}

function scriptedClient(results: Record<string, any>[]) {
  const queue = [...results];
  return {
    from: vi.fn(() => {
      const query: any = {};
      for (const method of ['select', 'insert', 'update', 'delete', 'eq']) {
        query[method] = vi.fn(() => query);
      }
      const next = async () => queue.shift() ?? { data: null, error: null };
      query.maybeSingle = vi.fn(next);
      query.single = vi.fn(next);
      query.then = (resolve: (value: unknown) => unknown) => next().then(resolve);
      return query;
    }),
  } as any;
}

const firstDevice = '10000000-0000-4000-8000-000000000001';
const secondDevice = '10000000-0000-4000-8000-000000000002';

function input(deviceId = firstDevice, endpoint = 'https://push.test/first') {
  return {
    deviceId,
    endpoint,
    auth: 'auth-key',
    p256dh: 'p256dh-key',
    userAgent: 'Test browser',
  };
}

describe('push subscription reconciliation', () => {
  it('validates the default Supabase configuration', () => {
    try {
      vi.stubEnv('SUPABASE_URL', '');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      expect(() => pushSubscriptionContracts.getSupabase()).toThrow(
        'Missing Supabase configuration'
      );

      vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
      expect(() => pushSubscriptionContracts.getSupabase()).toThrow(
        'Missing Supabase configuration'
      );

      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
      expect(pushSubscriptionContracts.getSupabase()).toBeDefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('repairs a changed browser endpoint for the same device', async () => {
    const fixture = createSupabaseFixture();

    await registerPushSubscriptionForUser('user-a', input(), fixture.client);
    await registerPushSubscriptionForUser(
      'user-a',
      input(firstDevice, 'https://push.test/rotated'),
      fixture.client
    );

    expect(fixture.tables.push_subscription).toHaveLength(1);
    expect(fixture.tables.push_subscription[0]).toMatchObject({
      user_id: 'user-a',
      device_id: firstDevice,
      endpoint: 'https://push.test/rotated',
    });
    expect(fixture.tables.notification_setting[0].delivery_settings.pushNotifications).toBe(true);
  });

  it('moves a proven browser subscription on account switch and disables the previous owner', async () => {
    const fixture = createSupabaseFixture({
      push_subscription: [
        {
          id: 'subscription-a',
          user_id: 'user-a',
          device_id: firstDevice,
          endpoint: 'https://push.test/shared',
          auth: 'auth-key',
          p256dh: 'p256dh-key',
        },
      ],
      notification_setting: [
        {
          id: 'setting-a',
          user_id: 'user-a',
          delivery_settings: { pushNotifications: true },
        },
      ],
    });

    await registerPushSubscriptionForUser(
      'user-b',
      input(firstDevice, 'https://push.test/shared'),
      fixture.client
    );

    expect(fixture.tables.push_subscription[0].user_id).toBe('user-b');
    expect(
      fixture.tables.notification_setting.find(row => row.user_id === 'user-a')?.delivery_settings
        ?.pushNotifications
    ).toBe(false);
    expect(
      fixture.tables.notification_setting.find(row => row.user_id === 'user-b')?.delivery_settings
        ?.pushNotifications
    ).toBe(true);
  });

  it('rejects an account transfer when the browser keys do not match', async () => {
    const fixture = createSupabaseFixture({
      push_subscription: [
        {
          id: 'subscription-a',
          user_id: 'user-a',
          device_id: firstDevice,
          endpoint: 'https://push.test/shared',
          auth: 'different-auth',
          p256dh: 'different-p256dh',
        },
      ],
    });

    await expect(
      registerPushSubscriptionForUser(
        'user-b',
        input(firstDevice, 'https://push.test/shared'),
        fixture.client
      )
    ).rejects.toBeInstanceOf(PushSubscriptionConflictError);
  });

  it('keeps the global switch enabled until the last device unsubscribes', async () => {
    const fixture = createSupabaseFixture();
    await registerPushSubscriptionForUser('user-a', input(), fixture.client);
    await registerPushSubscriptionForUser(
      'user-a',
      input(secondDevice, 'https://push.test/second'),
      fixture.client
    );

    await unregisterPushSubscriptionForUser('user-a', firstDevice, fixture.client);
    expect(fixture.tables.push_subscription).toHaveLength(1);
    expect(fixture.tables.notification_setting[0].delivery_settings.pushNotifications).toBe(true);

    await unregisterPushSubscriptionForUser('user-a', secondDevice, fixture.client);
    expect(fixture.tables.push_subscription).toHaveLength(0);
    expect(fixture.tables.notification_setting[0].delivery_settings.pushNotifications).toBe(false);
  });

  it('loads a device subscription and surfaces lookup failures', async () => {
    await expect(
      getPushSubscriptionForDevice(
        'user-a',
        firstDevice,
        scriptedClient([{ data: { id: 'subscription' }, error: null }])
      )
    ).resolves.toEqual({ id: 'subscription' });
    await expect(
      getPushSubscriptionForDevice(
        'user-a',
        firstDevice,
        scriptedClient([{ error: { message: 'lookup failed' } }])
      )
    ).rejects.toThrow('lookup failed');
  });

  it('surfaces endpoint, device, deletion, update, count, and insert failures', async () => {
    await expect(
      registerPushSubscriptionForUser(
        'user-a',
        input(),
        scriptedClient([{ error: { message: 'endpoint' } }, { data: null, error: null }])
      )
    ).rejects.toThrow('endpoint');
    await expect(
      registerPushSubscriptionForUser(
        'user-a',
        input(),
        scriptedClient([{ data: null, error: null }, { error: { message: 'device' } }])
      )
    ).rejects.toThrow('device');
    await expect(
      registerPushSubscriptionForUser(
        'user-a',
        input(),
        scriptedClient([
          { data: null, error: null },
          { data: { id: 'old-device' }, error: null },
          { error: { message: 'delete' } },
        ])
      )
    ).rejects.toThrow('delete');
    await expect(
      registerPushSubscriptionForUser(
        'user-a',
        input(),
        scriptedClient([
          { data: { id: 'same', user_id: 'user-a' }, error: null },
          { data: { id: 'same' }, error: null },
          { error: { message: 'update' } },
        ])
      )
    ).rejects.toThrow('update');
    await expect(
      registerPushSubscriptionForUser(
        'user-b',
        input(),
        scriptedClient([
          {
            data: {
              id: 'same',
              user_id: 'user-a',
              auth: 'auth-key',
              p256dh: 'p256dh-key',
            },
            error: null,
          },
          { data: null, error: null },
          { data: { id: 'same' }, error: null },
          { data: null, error: null },
          { error: null },
          { count: null, error: { message: 'count' } },
        ])
      )
    ).rejects.toThrow('count');
    await expect(
      registerPushSubscriptionForUser(
        'user-a',
        { ...input(), userAgent: undefined },
        scriptedClient([
          { data: null, error: null },
          { data: null, error: null },
          { error: { message: 'insert' } },
        ])
      )
    ).rejects.toThrow('insert');
  });

  it('covers successful endpoint updates and previous-owner device counts', async () => {
    const sameUser = await registerPushSubscriptionForUser(
      'user-a',
      input(),
      scriptedClient([
        {
          data: {
            id: 'same',
            user_id: 'user-a',
            auth: 'auth-key',
            p256dh: 'p256dh-key',
          },
          error: null,
        },
        { data: { id: 'same' }, error: null },
        { data: { id: 'same' }, error: null },
        { data: null, error: null },
        { error: null },
      ])
    );
    expect(sameUser).toEqual({ id: 'same' });

    const retainedPreviousOwner = await registerPushSubscriptionForUser(
      'user-b',
      input(),
      scriptedClient([
        {
          data: {
            id: 'transferred',
            user_id: 'user-a',
            auth: 'auth-key',
            p256dh: 'p256dh-key',
          },
          error: null,
        },
        { data: null, error: null },
        { data: { id: 'transferred' }, error: null },
        { data: null, error: null },
        { error: null },
        { count: 1, error: null },
      ])
    );
    expect(retainedPreviousOwner).toEqual({ id: 'transferred' });

    await expect(
      registerPushSubscriptionForUser(
        'user-b',
        input(),
        scriptedClient([
          {
            data: {
              id: 'transferred',
              user_id: 'user-a',
              auth: 'auth-key',
              p256dh: 'p256dh-key',
            },
            error: null,
          },
          { data: null, error: null },
          { data: { id: 'transferred' }, error: null },
          { data: null, error: null },
          { error: null },
          { count: null, error: null },
          { data: null, error: null },
          { error: null },
        ])
      )
    ).resolves.toEqual({ id: 'transferred' });
  });

  it('surfaces notification setting and unregister persistence errors', async () => {
    await expect(
      pushSubscriptionContracts.setPushDeliverySetting(
        scriptedClient([{ error: { message: 'setting load' } }]),
        'user-a',
        true
      )
    ).rejects.toThrow('setting load');
    await expect(
      pushSubscriptionContracts.setPushDeliverySetting(
        scriptedClient([
          { data: { id: 'setting', delivery_settings: null }, error: null },
          { error: { message: 'setting update' } },
        ]),
        'user-a',
        true
      )
    ).rejects.toThrow('setting update');
    await expect(
      pushSubscriptionContracts.setPushDeliverySetting(
        scriptedClient([{ data: null, error: null }, { error: { message: 'setting insert' } }]),
        'user-a',
        true
      )
    ).rejects.toThrow('setting insert');
    await expect(
      unregisterPushSubscriptionForUser(
        'user-a',
        firstDevice,
        scriptedClient([{ error: { message: 'delete' } }])
      )
    ).rejects.toThrow('delete');
    await expect(
      unregisterPushSubscriptionForUser(
        'user-a',
        firstDevice,
        scriptedClient([{ error: null }, { error: { message: 'count' } }])
      )
    ).rejects.toThrow('count');
    await expect(
      unregisterPushSubscriptionForUser(
        'user-a',
        firstDevice,
        scriptedClient([
          { error: null },
          { count: null, error: null },
          { data: null, error: null },
          { error: null },
        ])
      )
    ).resolves.toBeUndefined();
  });
});
