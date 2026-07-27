import { describe, expect, it } from 'vitest';

import {
  registerPushSubscriptionForUser,
  unregisterPushSubscriptionForUser,
  PushSubscriptionConflictError,
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
});
