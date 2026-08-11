import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import {
  gotoReady,
  groupActors,
  openGroupActorPage,
  resetMembership,
} from './fixtures/domains/groups';

test('second actor requests membership, admin approves, and rights survive reload @pr @critical @acceptance', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const applicant = e2eRun.actor(groupActors.member);
  const applicantHandle = `e2e-${applicant.id.slice(0, 8)}`;
  const actorPage = await openGroupActorPage(browser, applicant);
  await resetMembership(seed.groupId, applicant.id);
  try {
    await gotoReady(actorPage.page, `/group/${seed.groupId}`);
    await actorPage.page.locator('[data-action-id="groups.wiki.manage.membership"]').click();
    await expect
      .poll(async () => {
        const rows = await db()`
          select status from public.group_membership
          where group_id = ${seed.groupId}::uuid and user_id = ${applicant.id}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('requested');

    await gotoReady(page, `/group/${seed.groupId}/memberships`);
    const requestRow = page.locator('tr').filter({ hasText: applicantHandle });
    const approve = requestRow.locator('[data-action-id="groups.requests.approve.membership"]');
    await expect(approve).toBeVisible({ timeout: 30_000 });
    await approve.click();
    await expect
      .poll(async () => {
        const rows = await db()`
          select status from public.group_membership
          where group_id = ${seed.groupId}::uuid and user_id = ${applicant.id}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('active');

    await actorPage.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      actorPage.page.locator('[data-action-id="groups.wiki.manage.membership"]')
    ).toHaveAccessibleName(/leave group/i, { timeout: 30_000 });
  } finally {
    await actorPage.close();
  }
});
