import { expect, test } from './fixtures/test';
import { finishOnboardingWithoutSelections } from './fixtures/auth-flow-page';
import { db } from './fixtures/db';

test('resumes interrupted onboarding and persists completion @pr', async ({ page, e2eUser }) => {
  const sql = db();
  const [original] = await sql<{ first_name: string | null; last_name: string | null }[]>`
    select first_name, last_name from public."user" where id = ${e2eUser.id}::uuid
  `;
  expect(original).toBeTruthy();

  try {
    await sql`
      update public."user" set first_name = null, last_name = null where id = ${e2eUser.id}::uuid
    `;
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('polity_onboarding', 'true'));
    await page.reload();
    await expect(page.locator('#firstName')).toBeVisible({ timeout: 90_000 });
    await page.locator('#firstName').fill('Resume');
    await page.locator('#lastName').fill('Flow');
    await page
      .locator('#onboarding-name-form')
      .evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect(page.getByRole('heading', { name: 'What are you interested in?' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'What are you interested in?' })).toBeVisible();
    await finishOnboardingWithoutSelections(page);
    await expect(page.getByRole('heading', { name: "You're all set!" })).toBeVisible();
    await page.locator('a[href="/search"]').click();

    await expect
      .poll(async () => {
        const [row] = await sql<{ first_name: string | null; last_name: string | null }[]>`
          select first_name, last_name from public."user" where id = ${e2eUser.id}::uuid
        `;
        return row;
      })
      .toEqual({ first_name: 'Resume', last_name: 'Flow' });
  } finally {
    if (original) {
      await sql`
        update public."user"
        set first_name = ${original.first_name}, last_name = ${original.last_name}
        where id = ${e2eUser.id}::uuid
      `;
    }
  }
});
