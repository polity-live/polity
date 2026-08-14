import type { Browser, BrowserContext, Page } from '@playwright/test';

import { ALPHA_WARNING_SESSION_KEY } from '@/features/shared/constants';

import { authenticateActor, removeActorAuthState, type E2EActorUser } from '../auth';
import { db, e2eBaseUrl } from '../db';
import { waitForAppReady } from '../readiness';
import { deterministicE2EUuid } from '../run';

export const groupActors = {
  admin: 'group-admin',
  member: 'group-member',
} as const;

export interface ActorPage {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function openGroupActorPage(
  browser: Browser,
  actor: E2EActorUser
): Promise<ActorPage> {
  await authenticateActor(browser, actor);
  const context = await browser.newContext({
    baseURL: e2eBaseUrl(),
    storageState: actor.storageStatePath,
  });
  await context.addInitScript(alphaWarningSessionKey => {
    window.sessionStorage.setItem(alphaWarningSessionKey, 'true');
  }, ALPHA_WARNING_SESSION_KEY);
  const page = await context.newPage();
  return {
    context,
    page,
    close: async () => {
      await context.close();
      await removeActorAuthState(actor);
    },
  };
}

export async function resetMembership(groupId: string, userId: string) {
  await db()`
    delete from public.group_membership
    where group_id = ${groupId}::uuid and user_id = ${userId}::uuid
  `;
}

export async function seedActiveMembership(
  prefix: string,
  groupId: string,
  userId: string,
  status: 'active' | 'admin' = 'active'
) {
  const id = deterministicE2EUuid(`${prefix}:group-membership:${groupId}:${userId}`);
  await db()`
    insert into public.group_membership (
      id, group_id, user_id, status, visibility, source, origin_kind,
      is_auto_managed, created_at
    ) values (
      ${id}::uuid, ${groupId}::uuid, ${userId}::uuid, ${status},
      'public', 'direct', 'direct', false, now()
    )
    on conflict (user_id, group_id) do update
    set status = excluded.status,
        source = excluded.source,
        origin_kind = excluded.origin_kind,
        is_auto_managed = false
  `;
  return id;
}

export async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}
