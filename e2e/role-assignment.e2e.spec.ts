import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { gotoReady } from './fixtures/domains/groups';

test('member receives a role and can see the persisted assignment after reload @pr', async ({
  page,
  seed,
}) => {
  await db()`
    update public.group_membership
    set status = 'active'
    where group_id = ${seed.groupId}::uuid and user_id = ${seed.extraUserId}::uuid;

    delete from public.group_membership_role
    where role_id = ${seed.roleId}::uuid
      and group_membership_id in (
        select id from public.group_membership where user_id = ${seed.extraUserId}::uuid
      );
  `;
  await gotoReady(page, `/group/${seed.groupId}/memberships`);
  const row = page.locator('tr').filter({ hasText: 'Fixture User' });
  await row.locator('[data-action-id="groups.members.active.change-role"]').click();
  const dialog = page.getByRole('dialog');
  const byLabel = dialog.getByLabel(seed.roleName);
  await expect(byLabel).toHaveAttribute('aria-checked', 'false');
  await byLabel.click();
  await expect(byLabel).toHaveAttribute('aria-checked', 'true');
  await dialog.locator('[data-action-id="groups.roles.change.confirm"]').click();

  await expect
    .poll(async () => {
      const rows = await db()`
        select count(*)::int as count
        from public.group_membership_role gmr
        join public.group_membership gm on gm.id = gmr.group_membership_id
        where gm.user_id = ${seed.extraUserId}::uuid
          and gm.group_id = ${seed.groupId}::uuid
          and gmr.role_id = ${seed.roleId}::uuid
      `;
      return rows[0]?.count ?? 0;
    })
    .toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const persistedRow = page.locator('tr').filter({ hasText: 'Fixture User' });
  await expect(persistedRow.getByText(seed.roleName, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
});
