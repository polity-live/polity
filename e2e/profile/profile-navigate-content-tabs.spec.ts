// spec: e2e/test-plans/profile-feature-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';
import { navigateToOwnProfile } from '../helpers/navigation';

test.describe('View Own Profile (Authenticated)', () => {
  test('Navigate Profile Content Tabs', async ({ authenticatedPage: page }) => {
    // 1. Authenticate and navigate to own profile
    await navigateToOwnProfile(page);

    // 2. Wait for the profile content tablist to be visible
    const tablist = page.locator('[role="tablist"]').last();
    await expect(tablist).toBeVisible({ timeout: 10000 });

    // 3. Verify the tabs are ordered and default to All
    const tabs = tablist.getByRole('tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toHaveText(/all/i);
    await expect(tabs.nth(1)).toHaveText(/amendments/i);
    await expect(tabs.nth(2)).toHaveText(/blogs/i);
    await expect(tabs.nth(3)).toHaveText(/groups/i);
    await expect(tabs.nth(4)).toHaveText(/statements/i);

    const allTab = tabs.nth(0);
    await expect(allTab).toHaveAttribute('aria-selected', 'true');

    const allPanelId = await allTab.getAttribute('aria-controls');
    expect(allPanelId).toBeTruthy();
    await expect(page.locator(`#${allPanelId}`)).toBeVisible({ timeout: 5000 });

    // 4. Verify each remaining tab can be activated and shows its panel
    for (const name of ['amendments', 'blogs', 'groups', 'statements']) {
      const tab = tablist.getByRole('tab', { name: new RegExp(name, 'i') });
      await tab.click();

      await expect(tab).toHaveAttribute('aria-selected', 'true');

      const panelId = await tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      await expect(page.locator(`#${panelId}`)).toBeVisible({ timeout: 5000 });
    }
  });
});
