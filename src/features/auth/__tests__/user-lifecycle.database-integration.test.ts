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
const conflictUserId = 'a1100000-0000-4000-a000-000000000004';

describe('user lifecycle database integration', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(databaseUrl, { max: 1 });
  });

  afterEach(async () => {
    await sql`
      delete from auth.users
      where id in (${authUserId}::uuid, ${deletionUserId}::uuid, ${conflictUserId}::uuid)
    `;
    await sql`
      delete from public."user"
      where id in (${authUserId}::uuid, ${deletionUserId}::uuid, ${conflictUserId}::uuid)
    `;
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

  it('rolls back auth creation and every default when the public profile conflicts', async () => {
    await sql`
      insert into public."user" (id, email)
      values (${conflictUserId}::uuid, 'existing-profile@polity.local')
    `;

    await expect(
      sql`
        insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
        values (
          ${conflictUserId}::uuid,
          'conflicting-auth@polity.local',
          'test-password-hash',
          '{"language":"de"}'::jsonb
        )
      `
    ).rejects.toMatchObject({ code: '23505' });

    const [result] = await sql<
      { auth_count: number; notification_count: number; preference_count: number }[]
    >`
      select
        (select count(*)::int from auth.users where id = ${conflictUserId}::uuid) auth_count,
        (select count(*)::int from public.notification_setting where user_id = ${conflictUserId}::uuid) notification_count,
        (select count(*)::int from public.user_preference where user_id = ${conflictUserId}::uuid) preference_count
    `;

    expect(result).toEqual({ auth_count: 0, notification_count: 0, preference_count: 0 });
  });

  it('deletes the auth user, profile and protected dependent relationships atomically', async () => {
    await sql`
      insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
      values (
        ${deletionUserId}::uuid,
        'lifecycle-delete@polity.local',
        'test-password-hash',
        '{"language":"en"}'::jsonb
      )
    `;
    await sql`
      insert into public.push_subscription (id, user_id, endpoint)
      values (${pushSubscriptionId}::uuid, ${deletionUserId}::uuid, 'https://push.invalid/lifecycle')
    `;
    await sql`delete from auth.users where id = ${deletionUserId}::uuid`;

    const [result] = await sql<
      {
        profile_count: number;
        notification_count: number;
        preference_count: number;
        push_count: number;
      }[]
    >`
      select
        (select count(*)::int from public."user" where id = ${deletionUserId}::uuid) profile_count,
        (select count(*)::int from public.notification_setting where user_id = ${deletionUserId}::uuid) notification_count,
        (select count(*)::int from public.user_preference where user_id = ${deletionUserId}::uuid) preference_count,
        (select count(*)::int from public.push_subscription where user_id = ${deletionUserId}::uuid) push_count
    `;

    expect(result).toEqual({
      profile_count: 0,
      notification_count: 0,
      preference_count: 0,
      push_count: 0,
    });
  });
});
