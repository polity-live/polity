import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  process.env.SUPABASE_DB_URL_LOCAL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

if (process.env.CI && !process.env.SUPABASE_DB_URL) {
  throw new Error('SUPABASE_DB_URL is required for database integration tests in CI.');
}
const authUserId = 'a1100000-0000-4000-a000-000000000001';
const deletionUserId = 'a1100000-0000-4000-a000-000000000002';
const pushSubscriptionId = 'a1100000-0000-4000-a000-000000000003';

describe('user lifecycle database integration', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(databaseUrl, { max: 1 });
  });

  afterEach(async () => {
    await sql`delete from public."user" where id in (${authUserId}::uuid, ${deletionUserId}::uuid)`;
    await sql`delete from auth.users where id in (${authUserId}::uuid, ${deletionUserId}::uuid)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('creates the profile, notification defaults and localized preferences atomically', async () => {
    await sql`
      insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
      values (
        ${authUserId}::uuid,
        'lifecycle-defaults@polity.local',
        'test-password-hash',
        '{"language":"de"}'::jsonb
      )
    `;

    const [result] = await sql<
      {
        profile_count: number;
        notification_count: number;
        preference_count: number;
        language: string;
      }[]
    >`
      select
        (select count(*)::int from public."user" where id = ${authUserId}::uuid) profile_count,
        (select count(*)::int from public.notification_setting where user_id = ${authUserId}::uuid) notification_count,
        (select count(*)::int from public.user_preference where user_id = ${authUserId}::uuid) preference_count,
        (select language from public.user_preference where user_id = ${authUserId}::uuid) language
    `;

    expect(result).toEqual({
      profile_count: 1,
      notification_count: 1,
      preference_count: 1,
      language: 'de',
    });
  });

  it('removes protected preference, notification and push relationships with the profile', async () => {
    await sql`
      insert into public."user" (id, email)
      values (${deletionUserId}::uuid, 'lifecycle-delete@polity.local')
    `;
    await sql`
      insert into public.notification_setting (user_id) values (${deletionUserId}::uuid)
    `;
    await sql`
      insert into public.user_preference (user_id) values (${deletionUserId}::uuid)
    `;
    await sql`
      insert into public.push_subscription (id, user_id, endpoint)
      values (${pushSubscriptionId}::uuid, ${deletionUserId}::uuid, 'https://push.invalid/lifecycle')
    `;
    await sql`
      delete from public."user" where id = ${deletionUserId}::uuid
    `;

    const [result] = await sql<
      { notification_count: number; preference_count: number; push_count: number }[]
    >`
      select
        (select count(*)::int from public.notification_setting where user_id = ${deletionUserId}::uuid) notification_count,
        (select count(*)::int from public.user_preference where user_id = ${deletionUserId}::uuid) preference_count,
        (select count(*)::int from public.push_subscription where user_id = ${deletionUserId}::uuid) push_count
    `;

    expect(result).toEqual({ notification_count: 0, preference_count: 0, push_count: 0 });
  });
});
