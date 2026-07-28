import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from '@playwright/test';

import { db, e2eBaseUrl, type E2EDatabase } from './db';

export const E2E_PASSWORD = 'e2e-password-123456';

export interface E2EWorkerUser {
  id: string;
  email: string;
  password: string;
  storageStatePath: string;
}

function workerUserId(workerIndex: number) {
  return `00000000-0000-4000-a000-${(workerIndex + 1).toString(16).padStart(12, '0')}`;
}

function workerHandle(workerIndex: number) {
  return `e2e-create-worker-${workerIndex}`;
}

export function workerUser(workerIndex: number): E2EWorkerUser {
  return {
    id: workerUserId(workerIndex),
    email: `e2e-create-flow-worker-${workerIndex}@polity.local`,
    password: E2E_PASSWORD,
    storageStatePath: path.join(process.cwd(), 'e2e', '.auth', `worker-${workerIndex}.json`),
  };
}

export async function ensureE2EAuthUser(user: E2EWorkerUser, createFormStyle = 'one_page') {
  const sql = db();
  const handle = workerHandle(Number(user.email.match(/worker-(\d+)/)?.[1] ?? 0));

  await sql`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ${user.id}::uuid,
      'authenticated',
      'authenticated',
      ${user.email},
      crypt(${user.password}, gen_salt('bf')),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', 'E2E',
        'last_name', 'Create Worker',
        'handle', ${handle}::text,
        'e2e_worker', true
      ),
      now() - interval '1 day',
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at,
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;
  `;

  await sql`
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      ${user.id}::uuid,
      ${user.id}::uuid,
      jsonb_build_object(
        'sub', ${user.id}::text,
        'email', ${user.email}::text,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      ${user.email},
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  `;

  await sql`
    insert into public."user" (
      id,
      email,
      handle,
      first_name,
      last_name,
      bio,
      visibility,
      created_at,
      updated_at
    )
    values (
      ${user.id}::uuid,
      ${user.email},
      ${handle},
      'E2E',
      'Create Worker',
      'E2E worker auth user',
      'public',
      now(),
      now()
    )
    on conflict (id) do update
    set email = excluded.email,
        handle = excluded.handle,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        bio = excluded.bio,
        visibility = excluded.visibility,
        updated_at = excluded.updated_at;
  `;

  await ensureUserDefaults(sql, user.id, createFormStyle);
}

export async function ensureUserDefaults(
  sql: E2EDatabase,
  userId: string,
  createFormStyle = 'one_page'
) {
  await sql`
    insert into public.notification_setting (user_id, created_at, updated_at)
    values (${userId}::uuid, now(), now())
    on conflict (user_id) do update
    set updated_at = excluded.updated_at;
  `;

  await sql`
    insert into public.user_preference (
      user_id,
      create_form_style,
      theme,
      language,
      navigation_view,
      group_network_layouts,
      decision_terminal_dashboard,
      created_at,
      updated_at
    )
    values (
      ${userId}::uuid,
      ${createFormStyle},
      'system',
      'en',
      'asButtonList',
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
    on conflict (user_id) do update
    set create_form_style = excluded.create_form_style,
        updated_at = excluded.updated_at;
  `;
}

export async function authenticateWorker(browser: Browser, workerIndex: number) {
  const user = workerUser(workerIndex);
  await ensureE2EAuthUser(user);
  await fs.mkdir(path.dirname(user.storageStatePath), { recursive: true });

  const context = await browser.newContext({ baseURL: e2eBaseUrl() });
  const page = await context.newPage();

  await page.goto('/auth/sign-in');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await Promise.all([
    page.waitForURL(url => url.pathname === '/home', { timeout: 40_000 }),
    page.locator('form button[type="submit"]').click(),
  ]);
  await page.goto('/create');
  await page.locator('[data-create-action="open-create-flow"]').first().waitFor({
    state: 'visible',
    timeout: 40_000,
  });

  await context.storageState({ path: user.storageStatePath });
  await context.close();

  return user;
}
