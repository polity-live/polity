import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { isLocalTestDatabase } from '@/test/local-database';

const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  process.env.SUPABASE_DB_URL_LOCAL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

if (process.env.CI && !process.env.SUPABASE_DB_URL) {
  throw new Error('SUPABASE_DB_URL is required for database integration tests in CI.');
}

if (!isLocalTestDatabase(databaseUrl)) {
  throw new Error('User lifecycle tests require a local test database.');
}

const authUserId = 'a1100000-0000-4000-a000-000000000001';
const deletionUserId = 'a1100000-0000-4000-a000-000000000002';
const pushSubscriptionId = 'a1100000-0000-4000-a000-000000000003';
const conflictUserId = 'a1100000-0000-4000-a000-000000000004';

describe('user lifecycle database integration', () => {
  let sql: ReturnType<typeof postgres>;
  let authSql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(databaseUrl, { max: 1 });
    const authDatabaseUrl = new URL(databaseUrl);
    authDatabaseUrl.username = 'supabase_auth_admin';
    authSql = postgres(authDatabaseUrl.toString(), { max: 1 });
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
    await authSql.end();
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

  it.each(['commit', 'explicit flush'])(
    'creates a profile and Studio projection as Auth admin with deferred triggers at %s',
    async flush => {
      await authSql.begin(async tx => {
        await tx`
          insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
          values (${authUserId}::uuid, 'lifecycle-auth-role@polity.local', 'test-password-hash', '{"language":"de"}'::jsonb)
        `;
        if (flush === 'explicit flush') {
          await tx`set constraints all immediate`;
        }
      });

      const [result] = await sql`
        select
          (select count(*)::int from public."user" where id = ${authUserId}::uuid) profile_count,
          (select count(*)::int from public.notification_setting where user_id = ${authUserId}::uuid) notification_count,
          (select language from public.user_preference where user_id = ${authUserId}::uuid) language,
          (select user_id from public.studio_live_source where source_type = 'user' and source_id = ${authUserId}::uuid) projected_user_id
      `;
      expect(result).toEqual({
        profile_count: 1,
        notification_count: 1,
        language: 'de',
        projected_user_id: authUserId,
      });
    }
  );

  it('refreshes the profile projection and removes it on deferred Auth admin deletion', async () => {
    await authSql.begin(async tx => {
      await tx`
        insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
        values (${authUserId}::uuid, 'lifecycle-auth-role@polity.local', 'test-password-hash', '{}'::jsonb)
      `;
    });

    await sql.begin(async tx => {
      await tx`update public."user" set first_name = 'Studio', last_name = 'Regression' where id = ${authUserId}::uuid`;
      await tx`set constraints all immediate`;
    });
    const [projection] = await sql`
      select payload->>'title' title from public.studio_live_source
      where source_type = 'user' and source_id = ${authUserId}::uuid
    `;
    expect(projection.title).toBe('Studio Regression');

    await authSql.begin(async tx => {
      await tx`delete from auth.users where id = ${authUserId}::uuid`;
      await tx`set constraints all immediate`;
    });
    const [remaining] = await sql`
      select
        (select count(*)::int from public."user" where id = ${authUserId}::uuid) profile_count,
        (select count(*)::int from public.studio_live_source where source_type = 'user' and source_id = ${authUserId}::uuid) projection_count
    `;
    expect(remaining).toEqual({ profile_count: 0, projection_count: 0 });
  });

  it('elevates only the deferred trigger while keeping Studio helpers and projections restricted', async () => {
    const [trigger] = await sql`
      select p.prosecdef, pg_get_userbyid(p.proowner) owner, p.proconfig
      from pg_proc p where p.oid = 'public.studio_source_changed()'::regprocedure
    `;
    expect(trigger).toEqual({ prosecdef: true, owner: 'postgres', proconfig: ['search_path=""'] });

    for (const role of ['anon', 'authenticated', 'supabase_auth_admin']) {
      const [privileges] = await sql`
        select
          has_function_privilege(${role}, 'public.studio_refresh_source(text,uuid)', 'EXECUTE') can_refresh,
          has_table_privilege(${role}, 'public.studio_live_source', 'INSERT,UPDATE,DELETE') can_write
      `;
      expect(privileges).toEqual({ can_refresh: false, can_write: false });
    }
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
