import { expect, test } from './fixtures/test';
import { waitForAppReady } from './fixtures/readiness';

test('keeps language and theme through a new page session @pr @mobile', async ({
  context,
  page,
  e2eUser,
}) => {
  const settings = `/user/${e2eUser.id}/settings?tab=preferences`;
  await page.goto(settings);
  await waitForAppReady(page);

  try {
    await page.locator('[data-action-id="navigation.language.popover.open"]').hover();
    await page.locator('[data-action-id="navigation.language.popover.german"]').click();
    await page.locator('[data-action-id="navigation.theme.dark.select"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const resumedPage = await context.newPage();
    await resumedPage.goto(settings);
    await waitForAppReady(resumedPage);
    await expect(resumedPage.locator('html')).toHaveClass(/dark/);
    await expect(
      resumedPage.locator('[data-action-id="navigation.language.popover.open"]')
    ).toContainText('🇩🇪');
    await resumedPage.close();
  } finally {
    await page.goto(settings);
    await page.locator('[data-action-id="navigation.language.popover.open"]').hover();
    await page.locator('[data-action-id="navigation.language.popover.english"]').click();
    await page.locator('[data-action-id="navigation.theme.system.select"]').click();
  }
});
