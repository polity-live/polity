import { expect, test } from './fixtures/test';
import { waitForAppReady } from './fixtures/readiness';

test('opens AI settings from a deep link @nightly', async ({ page, e2eUser }) => {
  await page.goto(`/user/${e2eUser.id}/settings?tab=ai`);
  await waitForAppReady(page);

  await expect(page).toHaveURL(new RegExp(`/user/${e2eUser.id}/settings\\?tab=ai$`));
  await expect(page.locator('[data-tutorial-anchor="settings-ai-skills"]')).toBeVisible();
  await expect(page.locator('[data-tutorial-anchor="settings-ai-tools"]')).toBeVisible();
});
