import { test, expect } from '../fixtures/test-base';
test.describe('Create Feature', () => {
  test('Load Create Page', async ({ authenticatedPage: page }) => {
    // Navigate to create page
    await page.goto('/create');

    // Verify page loads successfully
    await expect(page).toHaveURL('/create');

    // Verify dashboard shows entity creation links after local data sync is ready.
    for (const href of [
      '/create/group',
      '/create/event',
      '/create/amendment',
      '/create/blog-entry',
      '/create/todo',
      '/create/statement',
    ]) {
      await expect(page.locator(`a[href="${href}"]`)).toBeVisible({ timeout: 30000 });
    }
  });

  test('Flow cards navigate without a full page reload', async ({ authenticatedPage: page }) => {
    await page.goto('/create');
    await expect(page).toHaveURL('/create');

    await page.evaluate(() => {
      (window as Window & { __spaMarker?: string }).__spaMarker = 'amendment-flow';
    });
    await page.locator('a[href="/create/amendment"]').click();
    await expect(page).toHaveURL('/create/amendment');
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __spaMarker?: string }).__spaMarker))
      .toBe('amendment-flow');

    await page.goto('/create');
    await page.evaluate(() => {
      (window as Window & { __spaMarker?: string }).__spaMarker = 'blog-flow';
    });
    await page.locator('a[href="/create/blog-entry"]').click();
    await expect(page).toHaveURL('/create/blog-entry');
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __spaMarker?: string }).__spaMarker))
      .toBe('blog-flow');
  });
});
