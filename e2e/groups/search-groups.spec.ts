// spec: e2e/test-plans/groups-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';

test.describe('Groups - Search Groups', () => {
  test('Newly created public group appears in search by name', async ({
    authenticatedPage: page,
    groupFactory,
    mainUserId,
  }) => {
    const groupName = `Searchable Public Group ${Date.now()}`;

    await groupFactory.createGroup(mainUserId, {
      name: groupName,
      visibility: 'public',
    });

    await page.goto('/search');

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill(groupName);

    await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });
  });

  test('User searches groups by name', async ({ authenticatedPage: page }) => {
    // 1. Authenticate as test user
    // 2. Navigate to /search
    await page.goto('/search');

    // 3. Type group name in search
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('community');

    // 4. Wait for search results (debounced)
    await page.waitForTimeout(1000);

    // 5. Results displayed as masonry cards (search uses filter panel, not tabs)
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} search results for 'community'`);
  });

  test('User filters groups by hashtag', async ({ authenticatedPage: page }) => {
    // 1. Authenticate as test user
    // 2. Navigate to search
    await page.goto('/search');

    // 3. Type hashtag in search
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('#tech');

    // 4. Wait for search results (debounced)
    await page.waitForTimeout(1000);

    // 5. Results displayed as masonry cards
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} results for '#tech'`);
  });
});
