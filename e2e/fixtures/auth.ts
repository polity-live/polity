import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, type Browser } from '@playwright/test';

import { db, e2eBaseUrl, type E2EDatabase } from './db';
import { waitForAppReady } from './readiness';
import { actorAuthStatePath, e2eActorId } from './run';

export const E2E_PASSWORD = 'e2e-password-123456';

function authTimeoutMs() {
  const configured = Number(process.env.E2E_AUTH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 90_000;
}

export interface E2EActorUser {
  actor: string;
  id: string;
  email: string;
  namespace: string;
  password: string;
  storageStatePath: string;
}

export type E2EWorkerUser = E2EActorUser;

function emailToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function actorHandle(userId: string) {
  return `e2e-${userId.slice(0, 8)}`;
}

export function actorUser(testNamespace: string, actor = 'primary'): E2EActorUser {
  const namespaceToken = emailToken(testNamespace);
  const actorToken = emailToken(actor).slice(0, 12);
  if (!namespaceToken || !actorToken) {
    throw new Error('E2E actor identity requires a non-empty namespace and actor.');
  }
  const id = e2eActorId(testNamespace, actor);
  const actorIdentity = `${actorToken}-${id.replaceAll('-', '').slice(0, 12)}`;
  const namespaceBudget = 58 - actorIdentity.length - 1;
  const localPart = `${namespaceToken.slice(0, namespaceBudget)}-${actorIdentity}`;
  return {
    actor,
    id,
    email: `${localPart}@polity.local`,
    namespace: testNamespace,
    password: E2E_PASSWORD,
    storageStatePath: actorAuthStatePath(testNamespace, actor),
  };
}

function supabaseAdminConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('E2E auth provisioning requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return { serviceRoleKey, url: url.replace(/\/$/, '') };
}

async function provisionAuthUser(user: E2EActorUser, handle: string) {
  const { url, serviceRoleKey } = supabaseAdminConfig();
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
  };
  const attributes = {
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      first_name: 'E2E',
      last_name: 'Test Actor',
      handle,
      e2e_actor: user.actor,
      e2e_prefix: user.namespace,
    },
  };
  const existing = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    headers,
  });
  if (!existing.ok && existing.status !== 404) {
    throw new Error(`Local Supabase admin user lookup failed with HTTP ${existing.status}.`);
  }

  const response = await fetch(`${url}/auth/v1/admin/users${existing.ok ? `/${user.id}` : ''}`, {
    method: existing.ok ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(existing.ok ? attributes : { id: user.id, ...attributes }),
  });

  if (!response.ok) {
    throw new Error(`Local Supabase admin user provisioning failed with HTTP ${response.status}.`);
  }
}

async function assertPasswordCredentials(user: E2EActorUser) {
  const { url, serviceRoleKey } = supabaseAdminConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!response.ok) {
    throw new Error(
      `Provisioned E2E password credentials failed verification with HTTP ${response.status}.`
    );
  }
}

export async function ensureE2EAuthUser(user: E2EActorUser, createFormStyle = 'one_page') {
  const sql = db();
  const handle = actorHandle(user.id);

  await provisionAuthUser(user, handle);

  await sql`
    update auth.users
    set created_at = now() - interval '1 day'
    where id = ${user.id}::uuid;
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
      'Test Actor',
      ${`${user.namespace} actor ${user.actor}`},
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
  await assertPasswordCredentials(user);
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

export async function authenticateActor(browser: Browser, user: E2EActorUser) {
  await ensureE2EAuthUser(user);
  await fs.mkdir(path.dirname(user.storageStatePath), { recursive: true });

  const context = await browser.newContext({ baseURL: e2eBaseUrl() });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  const authTraffic: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('requestfailed', request =>
    browserErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
  );
  page.on('request', request => {
    if (request.url().includes('/auth/v1/')) {
      let credentialMatch = '';
      if (request.url().includes('/token') && request.postData()) {
        try {
          const body = request.postDataJSON() as {
            email?: string;
            password?: string;
          };
          credentialMatch = ` emailMatch=${body.email === user.email} passwordMatch=${body.password === user.password}`;
        } catch {
          credentialMatch = ' unreadableBody=true';
        }
      }
      authTraffic.push(
        `${request.method()} ${new URL(request.url()).origin}${new URL(request.url()).pathname}${credentialMatch}`
      );
    }
  });
  page.on('response', response => {
    if (response.url().includes('/auth/v1/')) {
      authTraffic.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
  try {
    await expect(page.getByTestId('app-hydration')).toHaveAttribute('data-state', 'hydrated', {
      timeout: 60_000,
    });
  } catch (error) {
    throw new Error(
      `App did not hydrate before ${user.actor} actor sign-in: ${browserErrors.join(' | ') || 'no browser error captured'}`,
      {
        cause: error,
      }
    );
  }
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toBeEnabled();
  await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  try {
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: authTimeoutMs() })
      .toBe('/home');
  } catch (error) {
    const visibleError = await page
      .getByRole('alert')
      .allTextContents()
      .catch(() => []);
    const formState = await page
      .locator('form')
      .evaluate(form => ({
        valid: (form as HTMLFormElement).checkValidity(),
        submitDisabled: Boolean(
          form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled
        ),
        emailLength: form.querySelector<HTMLInputElement>('#email')?.value.length ?? -1,
        passwordLength: form.querySelector<HTMLInputElement>('#password')?.value.length ?? -1,
      }))
      .catch(() => null);
    throw new Error(
      `${user.actor} actor sign-in did not reach /home (current URL: ${page.url()}, alerts: ${visibleError.join(' | ') || 'none'}, browser errors: ${browserErrors.join(' | ') || 'none'}, auth traffic: ${authTraffic.join(' | ') || 'none'}, form: ${JSON.stringify(formState)}).`,
      { cause: error }
    );
  }

  await page.goto('/create', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page, 120_000);

  await context.storageState({ path: user.storageStatePath });
  await context.close();

  return user;
}

export async function removeActorAuthState(user: E2EActorUser) {
  await fs.rm(user.storageStatePath, { force: true });
}
