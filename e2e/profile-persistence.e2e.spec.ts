import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';

test('persists profile edits across desktop and mobile reloads @pr @mobile', async ({
  page,
  e2eUser,
}) => {
  const sql = db();
  const [original] = await sql<{ first_name: string | null }[]>`
    select first_name from public."user" where id = ${e2eUser.id}::uuid
  `;
  const editedName = `Flow-${e2eUser.id.slice(0, 8)}`;

  try {
    await page.goto(`/user/${e2eUser.id}/settings?tab=basic-info`);
    await waitForAppReady(page);
    await page.locator('#firstName').fill(editedName);
    await page
      .locator('form[data-action-id="users.profile.save"]')
      .evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect
      .poll(async () => {
        const [row] = await sql<{ first_name: string | null }[]>`
          select first_name from public."user" where id = ${e2eUser.id}::uuid
        `;
        return row?.first_name;
      })
      .toBe(editedName);

    await page.goto(`/user/${e2eUser.id}/settings?tab=basic-info`);
    await page.reload();
    await expect(page.locator('#firstName')).toHaveValue(editedName);
  } finally {
    await sql`
      update public."user" set first_name = ${original?.first_name ?? null}
      where id = ${e2eUser.id}::uuid
    `;
  }
});
