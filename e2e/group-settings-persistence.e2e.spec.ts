import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import {
  gotoReady,
  groupActors,
  openGroupActorPage,
  seedActiveMembership,
} from './fixtures/domains/groups';

test('group settings and visibility persist and are visible to a second actor @nightly', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const member = e2eRun.actor(groupActors.member);
  const memberPage = await openGroupActorPage(browser, member);
  const membershipId = await seedActiveMembership(e2eRun.prefix, seed.groupId, member.id, 'active');
  e2eRun.registerEntityId(membershipId);
  const updatedName = `${e2eRun.prefix} Persisted Private Group`;
  try {
    await gotoReady(page, `/group/${seed.groupId}/settings`);
    const name = page.locator('#name');
    await expect(name).toBeVisible();
    await name.fill(updatedName);
    const visibility = page.locator('[data-create-option="private"]:visible');
    await expect(visibility).toBeVisible();
    await visibility.click();
    await page.locator('[data-action-id="groups.edit.submit"]').click();

    await expect
      .poll(async () => {
        const rows = await db()`
          select name, visibility from public."group" where id = ${seed.groupId}::uuid
        `;
        return rows[0] ?? null;
      })
      .toMatchObject({ name: updatedName, visibility: 'private' });

    await gotoReady(memberPage.page, `/group/${seed.groupId}`);
    const groupHeading = memberPage.page.getByRole('heading', {
      name: updatedName,
      exact: true,
    });
    await expect(groupHeading).toBeVisible({ timeout: 30_000 });
    await memberPage.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(groupHeading).toBeVisible({ timeout: 30_000 });
  } finally {
    await memberPage.close();
  }
});
