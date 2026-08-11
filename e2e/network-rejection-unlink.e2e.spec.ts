import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import {
  gotoReady,
  groupActors,
  openGroupActorPage,
  seedActiveMembership,
} from './fixtures/domains/groups';

test('rejects a link request, reconnects, and unlinks the active relationship @nightly', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const approver = e2eRun.actor(groupActors.admin);
  const approverPage = await openGroupActorPage(browser, approver);
  const membershipId = await seedActiveMembership(
    e2eRun.prefix,
    seed.linkedGroupId,
    approver.id,
    'admin'
  );
  e2eRun.registerEntityId(membershipId);
  await db()`
    update public."group" set owner_id = ${approver.id}::uuid where id = ${seed.linkedGroupId}::uuid;
    delete from public.group_membership
    where group_id = ${seed.linkedGroupId}::uuid and user_id = ${seed.userId}::uuid;
  `;

  const propose = async () => {
    await gotoReady(page, `/group/${seed.groupId}/network?tab=manage-network`);
    await page.locator('[data-action-id="network.link-group.open"]').click();
    const dialog = page.getByRole('dialog');
    const search = dialog.locator('[data-tutorial-anchor="network-group-search"] input');
    await search.fill(seed.linkedGroupName);
    const target = dialog
      .locator('[data-typeahead-result]')
      .filter({ hasText: seed.linkedGroupName });
    await expect(target).toHaveCount(1, { timeout: 30_000 });
    await target.click();
    const submit = dialog.locator('[data-action-id="network.link-group.submit"]');
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();
  };

  const confirmDelete = async () => {
    const confirmation = approverPage.page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: /delete/i }).click();
  };

  try {
    await gotoReady(approverPage.page, `/group/${seed.linkedGroupId}/network?tab=manage-network`);
    await propose();
    const requestRow = approverPage.page.locator('tr').filter({ hasText: seed.groupName });
    await expect(
      requestRow.locator('[data-action-id="network.relationship.delete.open"]')
    ).toBeVisible({ timeout: 45_000 });
    await requestRow.locator('[data-action-id="network.relationship.delete.open"]').click();
    await confirmDelete();
    await expect
      .poll(async () => {
        const rows = await db()`
          select count(*)::int as count from public.group_connection
          where group_a_id = least(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
            and group_b_id = greatest(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
        `;
        return rows[0]?.count ?? 0;
      })
      .toBe(0);

    await propose();
    await approverPage.page.reload({ waitUntil: 'domcontentloaded' });
    const approve = approverPage.page.locator(
      '[data-action-id="network.relationship.request.approve"]'
    );
    await expect(approve).toBeVisible({ timeout: 45_000 });
    await approve.click();
    await expect
      .poll(async () => {
        const rows = await db()`
          select status from public.group_connection
          where group_a_id = least(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
            and group_b_id = greatest(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('active');

    await approverPage.page.reload({ waitUntil: 'domcontentloaded' });
    const activeRow = approverPage.page.locator('tr').filter({ hasText: seed.groupName });
    await activeRow.locator('[data-action-id="network.relationship.active.delete.open"]').click();
    await confirmDelete();
    await expect
      .poll(async () => {
        const rows = await db()`
          select count(*)::int as count from public.group_connection
          where group_a_id = least(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
            and group_b_id = greatest(${seed.groupId}::uuid, ${seed.linkedGroupId}::uuid)
        `;
        return rows[0]?.count ?? 0;
      })
      .toBe(0);
  } finally {
    await approverPage.close();
  }
});
