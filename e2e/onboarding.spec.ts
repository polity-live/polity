import { test, expect } from './fixtures/test';
import { db } from './fixtures/db';

test('completes onboarding without interests or groups', async ({ page, e2eUser }) => {
  const sql = db();
  const originalRows = await sql<{ first_name: string | null; last_name: string | null }[]>`
    select first_name, last_name
    from public."user"
    where id = ${e2eUser.id}
  `;
  const originalProfile = originalRows[0];
  expect(originalProfile).toBeTruthy();

  try {
    await sql`
      update public."user"
      set first_name = null, last_name = null
      where id = ${e2eUser.id}
    `;

    await page.goto('/');

    await expect(page.locator('#firstName')).toBeVisible();
    await page.locator('#firstName').fill('E2E');
    await page.locator('#lastName').fill('Onboarding');
    await page
      .locator('#onboarding-name-form')
      .evaluate(form => (form as HTMLFormElement).requestSubmit());

    await expect(page.getByRole('heading', { name: 'What are you interested in?' })).toBeVisible();
    await page.locator('[data-slot="onboarding-action-bar"] button').last().click();

    await expect(page.getByRole('heading', { name: 'Find your group' })).toBeVisible();
    await page.locator('[data-slot="onboarding-action-bar"] button').last().click();

    await expect(page.getByRole('heading', { name: 'Welcome to Polity!' })).toBeVisible();
    await page.locator('[data-slot="onboarding-action-bar"] button').last().click();

    await expect(
      page.getByRole('heading', {
        name: 'Install Polity on this device',
      })
    ).toBeVisible();
    await page.locator('[data-slot="onboarding-action-bar"] button').last().click();

    await expect(page.getByRole('heading', { name: "You're all set!" })).toBeVisible();
    await expect(page.getByText('E2E Onboarding', { exact: true })).toBeVisible();
    await page.locator('a[href="/search"]').click();
    await expect(page).toHaveURL(/\/search$/);

    await expect
      .poll(async () => {
        const rows = await sql<{ first_name: string | null; last_name: string | null }[]>`
          select first_name, last_name
          from public."user"
          where id = ${e2eUser.id}
        `;
        return rows[0];
      })
      .toEqual({ first_name: 'E2E', last_name: 'Onboarding' });
  } finally {
    if (originalProfile) {
      await sql`
        update public."user"
        set first_name = ${originalProfile.first_name},
            last_name = ${originalProfile.last_name}
        where id = ${e2eUser.id}
      `;
    }
  }
});
