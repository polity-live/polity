import type { Page } from '@playwright/test';

import type { E2EActorUser } from '../auth';
import { db } from '../db';
import { deterministicE2EUuid } from '../run';

export async function getLocalActorAccessToken(actor: E2EActorUser) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Dataset E2E auth requires the local Supabase URL and anon key.');
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: actor.email, password: actor.password }),
    }
  );
  const body = (await response.json()) as { access_token?: unknown };
  if (!response.ok || typeof body.access_token !== 'string') {
    throw new Error(`Local Supabase actor sign-in failed with HTTP ${response.status}.`);
  }
  return body.access_token;
}

export async function installDatasetProviderFakes(page: Page) {
  const requests: string[] = [];
  await page.route('https://api.frankfurter.dev/**', async route => {
    requests.push(route.request().url());
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'local deterministic currency outage' }),
    });
  });
  await page.route('**/api/currency/rates', async route => {
    requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rates: [
          {
            baseCurrency: 'EUR',
            quoteCurrency: 'USD',
            requestedDate: null,
            rateDate: '2026-08-11',
            rate: 1.1,
            source: 'local-e2e',
            cacheStatus: 'stale',
          },
        ],
      }),
    });
  });
  return requests;
}

export async function seedDatasetFlow(prefix: string, ownerId: string, groupId: string) {
  const sql = db();
  const datasetId = deterministicE2EUuid(`${prefix}:dataset`);
  const snapshotId = deterministicE2EUuid(`${prefix}:dataset:snapshot`);
  const title = `${prefix} climate dataset`;
  await sql`
    insert into public.dataset (
      id, provider, provider_dataset_id, provider_resource_id, title, visibility,
      owner_user_id, group_id, created_by_id, status, columns, column_profiles
    ) values (
      ${datasetId}::uuid, 'UPLOAD', ${`${prefix}.csv`}, ${`${prefix}-resource`}, ${title},
      'private', ${ownerId}::uuid, ${groupId}::uuid, ${ownerId}::uuid, 'active',
      '[{"name":"Year"},{"name":"Value"}]'::jsonb,
      '[{"name":"Year","type":"date"},{"name":"Value","type":"number"}]'::jsonb
    ) on conflict (id) do nothing
  `;
  await sql`
    insert into public.dataset_snapshot (
      id, dataset_id, snapshot_key, storage_path, content_hash, status, created_by_id,
      columns, column_profiles, row_count, column_count
    ) values (
      ${snapshotId}::uuid, ${datasetId}::uuid, ${`${prefix}-snapshot`},
      ${`${prefix}/dataset.csv`}, ${`${prefix}-hash`}, 'ready', ${ownerId}::uuid,
      '[{"name":"Year"},{"name":"Value"}]'::jsonb,
      '[{"name":"Year","type":"date"},{"name":"Value","type":"number"}]'::jsonb,
      2, 2
    ) on conflict (id) do nothing
  `;
  return { datasetId, snapshotId, title };
}

export async function cleanupDatasetFlow(datasetId: string) {
  await db()`delete from public.dataset where id = ${datasetId}::uuid`;
}
