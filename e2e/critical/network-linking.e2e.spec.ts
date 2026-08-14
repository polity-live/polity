import { ALPHA_WARNING_SESSION_KEY } from '@/features/shared/constants';

import { expect, test } from '../fixtures/test';
import { ensureE2EAuthUser } from '../fixtures/auth';
import { db, e2eBaseUrl } from '../fixtures/db';
import { waitForAppReady } from '../fixtures/readiness';
import { deterministicE2EUuid } from '../fixtures/run';

test('links two groups after realtime approval by a second administrator @pr @critical', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const approverMembershipId = deterministicE2EUuid(`${e2eRun.prefix}:network-approver-membership`);
  const approver = e2eRun.actor('network-approver');
  e2eRun.registerEntityId(approverMembershipId);
  await ensureE2EAuthUser(approver);

  // Give each actor authority over exactly one endpoint and remove overlapping memberships.
  await sql`
    update public."group"
    set owner_id = ${approver.id}::uuid
    where id = ${seed.linkedGroupId}::uuid;

    insert into public.group_membership (
      id, group_id, user_id, status, visibility, source, origin_kind,
      is_auto_managed, created_at
    ) values (
      ${approverMembershipId}::uuid, ${seed.linkedGroupId}::uuid, ${approver.id}::uuid,
      'admin', 'public', 'direct', 'direct', false, now()
    )
    on conflict (user_id, group_id) do update
    set status = excluded.status,
        visibility = excluded.visibility,
        source = excluded.source,
        origin_kind = excluded.origin_kind,
        is_auto_managed = excluded.is_auto_managed;

    delete from public.group_membership
    where (group_id = ${seed.linkedGroupId}::uuid and user_id = ${seed.userId}::uuid)
       or (group_id = ${seed.groupId}::uuid and user_id = ${approver.id}::uuid);
  `;

  const approverContext = await browser.newContext({ baseURL: e2eBaseUrl() });
  await approverContext.addInitScript(alphaWarningSessionKey => {
    window.sessionStorage.setItem(alphaWarningSessionKey, 'true');
  }, ALPHA_WARNING_SESSION_KEY);
  const approverPage = await approverContext.newPage();
  try {
    await approverPage.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
    await expect(approverPage.getByTestId('app-hydration')).toHaveAttribute(
      'data-state',
      'hydrated'
    );
    await approverPage.locator('#email').fill(approver.email);
    await approverPage.locator('#password').fill(approver.password);
    await approverPage.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect
      .poll(() => new URL(approverPage.url()).pathname, { timeout: 90_000 })
      .toBe('/home');

    await approverPage.goto(`/group/${seed.linkedGroupId}/network?tab=manage-network`);
    await waitForAppReady(approverPage);

    await page.goto(`/group/${seed.groupId}/network?tab=manage-network`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="network.link-group.open"]').click();

    const linkDialog = page.getByRole('dialog');
    const groupSearch = linkDialog.locator('[data-tutorial-anchor="network-group-search"] input');
    await expect(groupSearch).toBeVisible();
    await groupSearch.fill(seed.linkedGroupName);
    const targetGroup = linkDialog
      .locator('[data-typeahead-result]')
      .filter({ hasText: seed.linkedGroupName });
    await expect(targetGroup).toHaveCount(1);
    await targetGroup.click();

    const submit = linkDialog.locator('[data-action-id="network.link-group.submit"]');
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();

    const approve = approverPage.locator('[data-action-id="network.relationship.request.approve"]');
    await expect(approve).toBeVisible({ timeout: 45_000 });
    await approve.click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select status
          from public.group_connection
          where group_a_id = least(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
            and group_b_id = greatest(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('active');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.locator('[data-action-id="network.tab.current.select"]').click();
    await expect(
      page.locator('.react-flow__node').filter({ hasText: seed.linkedGroupName })
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await approverContext.close();
  }
});
