import postgres, { type Sql } from 'postgres';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMultiMeasureProjectionPoints } from '@/server/datasets/projection';
import { archiveDataset } from '@/server/datasets/service';
import { executePushDelivery } from '@/server/push-delivery-service';

type Row = Record<string, any>;

const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  process.env.ZERO_UPSTREAM_DB ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = postgres(databaseUrl, { max: 2, prepare: false });

const ids = {
  pushUser: 'a4000000-0000-4000-a000-000000000001',
  notification: 'a4000000-0000-4000-a000-000000000002',
  subscription: 'a4000000-0000-4000-a000-000000000003',
  owner: 'a4000000-0000-4000-a000-000000000004',
  outsider: 'a4000000-0000-4000-a000-000000000005',
  group: 'a4000000-0000-4000-a000-000000000006',
  dataset: 'a4000000-0000-4000-a000-000000000007',
  snapshot: 'a4000000-0000-4000-a000-000000000008',
} as const;

async function cleanupFixtures() {
  await sql`delete from public.notification where id = ${ids.notification}::uuid`;
  await sql`delete from public.push_subscription where id = ${ids.subscription}::uuid`;
  await sql`delete from public.dataset where id = ${ids.dataset}::uuid`;
  await sql`delete from public."group" where id = ${ids.group}::uuid`;
  await sql`
    delete from public."user"
    where id in (${ids.pushUser}::uuid, ${ids.owner}::uuid, ${ids.outsider}::uuid)
  `;
}

class PostgresPushQuery {
  private operation: 'select' | 'update' | 'delete' = 'select';
  private values: Row = {};
  private filters: Row = {};

  constructor(
    private readonly connection: Sql,
    private readonly table: string
  ) {}

  select() {
    this.operation = 'select';
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
    this.filters[column] = value;
    return this;
  }

  private async execute(): Promise<{ data: Row[]; error: null }> {
    if (this.table === 'push_subscription') {
      const id = String(this.filters.id ?? '');
      if (this.operation === 'delete') {
        await this.connection`delete from public.push_subscription where id = ${id}::uuid`;
        return { data: [], error: null };
      }
      const rows = await this.connection<Row[]>`
        select id::text, user_id::text, endpoint, auth, p256dh
        from public.push_subscription where id = ${id}::uuid
      `;
      return { data: rows, error: null };
    }
    if (this.table === 'notification_setting') {
      const userId = String(this.filters.user_id ?? '');
      const rows = await this.connection<Row[]>`
        select delivery_settings, group_notifications, event_notifications,
          amendment_notifications, blog_notifications, todo_notifications, social_notifications
        from public.notification_setting where user_id = ${userId}::uuid
      `;
      return { data: rows, error: null };
    }
    if (this.table === 'user_preference') {
      const userId = String(this.filters.user_id ?? '');
      const rows = await this.connection<Row[]>`
        select language from public.user_preference where user_id = ${userId}::uuid
      `;
      return { data: rows, error: null };
    }
    if (this.table === 'push_delivery_outbox' && this.operation === 'update') {
      const id = Number(this.filters.id);
      await this.connection`
        update public.push_delivery_outbox set
          status = coalesce(${this.values.status ?? null}, status),
          completed_at = ${this.values.completed_at ?? null},
          locked_at = ${this.values.locked_at ?? null},
          last_error = ${this.values.last_error ?? null},
          skip_reason = ${this.values.skip_reason ?? null},
          updated_at = ${this.values.updated_at ?? new Date().toISOString()}
        where id = ${id}
      `;
      return { data: [], error: null };
    }
    throw new Error(`Unsupported PostgreSQL push query: ${this.operation} ${this.table}`);
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: result.data[0] ?? null, error: null };
  }
  then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }
}

function postgresPushClient(connection: Sql) {
  return {
    from(table: string) {
      return new PostgresPushQuery(connection, table);
    },
    async rpc(name: string, args: Row) {
      if (name === 'claim_push_notification_jobs') {
        const rows = await connection<Row[]>`
          select * from public.claim_push_notification_jobs(
            ${Number(args.job_limit)}, ${args.notification_filter as string}::uuid
          )
        `;
        return { data: rows, error: null };
      }
      if (name === 'expand_push_notification_job') {
        const rows = await connection<Row[]>`
          select public.expand_push_notification_job(${Number(args.target_job_id)}) as value
        `;
        return { data: rows[0]?.value ?? 0, error: null };
      }
      if (name === 'claim_push_delivery_jobs') {
        const rows = await connection<Row[]>`
          select * from public.claim_push_delivery_jobs(
            ${Number(args.job_limit)}, ${args.notification_filter as string}::uuid,
            ${args.delivery_filter as number | null}::bigint
          )
        `;
        return { data: rows, error: null };
      }
      throw new Error(`Unsupported PostgreSQL push RPC: ${name}`);
    },
  } as any;
}

describe('outbox and dataset database integration', () => {
  beforeEach(cleanupFixtures);
  afterAll(async () => {
    await cleanupFixtures();
    await sql.end({ timeout: 5 });
  });

  it('expands a notification into the push outbox and completes it with a stub sender', async () => {
    await sql`
      insert into public."user" (id, handle)
      values (${ids.pushUser}::uuid, 'db-push-user')
    `;
    await sql`
      insert into public.push_subscription (id, user_id, device_id, endpoint, auth, p256dh)
      values (
        ${ids.subscription}::uuid, ${ids.pushUser}::uuid,
        'a4000000-0000-4000-a000-000000000009'::uuid,
        'https://push.test/database-integration', 'auth-local', 'p256dh-local'
      )
    `;
    await sql`
      insert into public.notification (
        id, recipient_id, title, message, type, action_url, category
      ) values (
        ${ids.notification}::uuid, ${ids.pushUser}::uuid, 'Database push',
        'Push through the real outbox', 'system_notification', '/notifications', 'system'
      )
    `;

    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const result = await executePushDelivery(
      { notificationId: ids.notification },
      {
        supabase: postgresPushClient(sql),
        config: { enabled: true, publicKey: 'local-public', privateKey: 'local-private' },
        initializeVapid: vi.fn(),
        sendNotification,
      }
    );
    expect(result).toMatchObject({ expanded: 1, claimed: 1, sent: 1, failed: 0 });
    expect(sendNotification).toHaveBeenCalledOnce();
    const rows = await sql<Row[]>`
      select status, completed_at is not null as completed
      from public.push_delivery_outbox where notification_id = ${ids.notification}::uuid
    `;
    expect(rows).toEqual([expect.objectContaining({ status: 'sent', completed: true })]);
  });

  it('copies snapshot schema, projects values, and enforces archive ownership', async () => {
    await sql`
      insert into public."user" (id, handle)
      values (${ids.owner}::uuid, 'db-dataset-owner'), (${ids.outsider}::uuid, 'db-dataset-outsider')
    `;
    await sql`
      insert into public."group" (id, name, owner_id)
      values (${ids.group}::uuid, 'Database dataset group', ${ids.owner}::uuid)
    `;
    await sql`
      insert into public.dataset (
        id, provider, provider_dataset_id, provider_resource_id, title, visibility,
        owner_user_id, group_id, created_by_id
      ) values (
        ${ids.dataset}::uuid, 'UPLOAD', 'database.csv', 'database-resource',
        'Database projection', 'private', ${ids.owner}::uuid, ${ids.group}::uuid, ${ids.owner}::uuid
      )
    `;
    await sql`
      insert into public.dataset_snapshot (
        id, dataset_id, snapshot_key, storage_path, content_hash, status,
        columns, column_profiles, row_count, column_count, created_by_id
      ) values (
        ${ids.snapshot}::uuid, ${ids.dataset}::uuid, 'database-snapshot',
        'database/snapshot.csv', 'database-hash', 'ready',
        '[{"name":"Year"},{"name":"North"},{"name":"South"}]'::jsonb,
        '[{"name":"Year","type":"date"},{"name":"North","type":"number"},{"name":"South","type":"number"}]'::jsonb,
        2, 3, ${ids.owner}::uuid
      )
    `;
    const datasetRows = await sql<Row[]>`
      select columns, column_profiles from public.dataset where id = ${ids.dataset}::uuid
    `;
    expect(datasetRows[0]?.columns).toEqual([
      { name: 'Year' },
      { name: 'North' },
      { name: 'South' },
    ]);
    const points = buildMultiMeasureProjectionPoints({
      table: {
        columns: ['Year', 'North', 'South'],
        rows: [
          { Year: '2025', North: '10', South: '12' },
          { Year: '2026', North: '14', South: '16' },
        ],
      },
      dimensionColumn: 'Year',
      valueColumns: ['North', 'South'],
      aggregation: 'sum',
    });
    expect(points).toHaveLength(4);
    await expect(archiveDataset(ids.dataset, ids.outsider)).rejects.toThrow(
      'permission to manage group datasets'
    );
    await expect(archiveDataset(ids.dataset, ids.owner)).resolves.toBeUndefined();
    const archived = await sql<Row[]>`
      select status from public.dataset where id = ${ids.dataset}::uuid
    `;
    expect(archived[0]?.status).toBe('archived');
  });
});
