import postgres from 'postgres';

interface ClaimRow {
  id: string;
  attempt_count: number;
}

const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const admin = postgres(databaseUrl, { max: 1 });
const workerA = postgres(databaseUrl, { max: 1 });
const workerB = postgres(databaseUrl, { max: 1 });

const userIds = [
  '91000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000002',
] as const;
const notificationIds = [
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002',
  '92000000-0000-0000-0000-000000000003',
] as const;
const subscriptionIds = [
  '93000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000002',
] as const;
const newsletterJobIds = [98001, 98002] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function cleanupFixtures(): Promise<void> {
  await admin`
    DELETE FROM public.newsletter_sync_outbox
    WHERE id IN (${newsletterJobIds[0]}, ${newsletterJobIds[1]})
  `;
  await admin`
    DELETE FROM public.push_delivery_outbox
    WHERE dedupe_key = 'database-concurrency-test'
  `;
  await admin`
    DELETE FROM public.notification
    WHERE id IN (
      ${notificationIds[0]},
      ${notificationIds[1]},
      ${notificationIds[2]}
    )
  `;
  await admin`
    DELETE FROM public.push_subscription
    WHERE id IN (${subscriptionIds[0]}, ${subscriptionIds[1]})
  `;
  await admin`
    DELETE FROM public."user"
    WHERE id IN (${userIds[0]}, ${userIds[1]})
  `;
}

async function concurrentClaims(
  label: string,
  claim: (transaction: postgres.TransactionSql) => Promise<ClaimRow[]>
): Promise<void> {
  let releaseFirst!: () => void;
  let firstLockedResolve!: () => void;
  let firstLockedReject!: (error: unknown) => void;

  const holdFirst = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  const firstLocked = new Promise<void>((resolve, reject) => {
    firstLockedResolve = resolve;
    firstLockedReject = reject;
  });

  let firstRows: ClaimRow[] = [];
  const firstTask = workerA.begin(async transaction => {
    try {
      firstRows = await claim(transaction);
      firstLockedResolve();
      await holdFirst;
    } catch (error) {
      firstLockedReject(error);
      throw error;
    }
  });

  await firstLocked;
  let secondRows: ClaimRow[] = [];
  try {
    secondRows = await workerB.begin(transaction => claim(transaction));
  } finally {
    releaseFirst();
  }
  await firstTask;

  assert(firstRows.length === 1, `${label}: first worker did not claim exactly one job`);
  assert(secondRows.length === 1, `${label}: second worker did not claim exactly one job`);
  assert(
    String(firstRows[0]?.id) !== String(secondRows[0]?.id),
    `${label}: both workers claimed the same locked job`
  );
  assert(
    firstRows[0]?.attempt_count === 1 && secondRows[0]?.attempt_count === 1,
    `${label}: claims did not increment attempt_count exactly once`
  );
}

try {
  await cleanupFixtures();

  await admin`
    INSERT INTO public."user" (id, handle)
    VALUES
      (${userIds[0]}, 'concurrency-user-1'),
      (${userIds[1]}, 'concurrency-user-2')
  `;

  await admin`
    INSERT INTO public.notification (id, recipient_id, title)
    VALUES
      (${notificationIds[0]}, ${userIds[0]}, 'Concurrent parent 1'),
      (${notificationIds[1]}, ${userIds[1]}, 'Concurrent parent 2')
  `;

  await concurrentClaims(
    'push parent claims',
    transaction =>
      transaction<ClaimRow[]>`
      SELECT id::TEXT, attempt_count
      FROM public.claim_push_notification_jobs(1, NULL::UUID)
    `
  );

  await admin`
    INSERT INTO public.notification (id, recipient_id, title)
    VALUES (${notificationIds[2]}, ${userIds[0]}, 'Concurrent delivery')
  `;
  await admin`
    INSERT INTO public.push_subscription (
      id, user_id, device_id, endpoint, auth, p256dh
    )
    VALUES
      (
        ${subscriptionIds[0]},
        ${userIds[0]},
        '94000000-0000-0000-0000-000000000001',
        'https://push.test/concurrency-1',
        'auth',
        'key'
      ),
      (
        ${subscriptionIds[1]},
        ${userIds[0]},
        '94000000-0000-0000-0000-000000000002',
        'https://push.test/concurrency-2',
        'auth',
        'key'
      )
  `;
  await admin`
    INSERT INTO public.push_delivery_outbox (
      notification_id,
      user_id,
      push_subscription_id,
      dedupe_key,
      payload
    )
    VALUES
      (
        ${notificationIds[2]},
        ${userIds[0]},
        ${subscriptionIds[0]},
        'database-concurrency-test',
        '{"title":"Concurrent delivery"}'
      ),
      (
        ${notificationIds[2]},
        ${userIds[0]},
        ${subscriptionIds[1]},
        'database-concurrency-test',
        '{"title":"Concurrent delivery"}'
      )
  `;

  await concurrentClaims(
    'push delivery claims',
    transaction =>
      transaction<ClaimRow[]>`
      SELECT id::TEXT, attempt_count
      FROM public.claim_push_delivery_jobs(
        1,
        ${notificationIds[2]}::UUID,
        NULL::BIGINT
      )
    `
  );

  await admin`
    INSERT INTO public.newsletter_sync_outbox (
      id, operation, email, language, status
    )
    VALUES
      (${newsletterJobIds[0]}, 'upsert', 'concurrency-1@test.invalid', 'en', 'pending'),
      (${newsletterJobIds[1]}, 'upsert', 'concurrency-2@test.invalid', 'de', 'pending')
  `;

  await concurrentClaims(
    'newsletter claims',
    transaction =>
      transaction<ClaimRow[]>`
      SELECT id::TEXT, attempt_count
      FROM public.claim_newsletter_sync_jobs(1)
      WHERE id IN (${newsletterJobIds[0]}, ${newsletterJobIds[1]})
    `
  );

  process.stdout.write(
    'Database concurrency tests passed: push parent, push delivery, and newsletter jobs use SKIP LOCKED without duplicate claims.\n'
  );
} finally {
  await cleanupFixtures();
  await Promise.all([
    admin.end({ timeout: 5 }),
    workerA.end({ timeout: 5 }),
    workerB.end({ timeout: 5 }),
  ]);
}
