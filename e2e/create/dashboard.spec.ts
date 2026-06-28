import { test, expect } from '../fixtures/test';

const createRoutes = [
  '/create/group',
  '/create/amendment',
  '/create/event',
  '/create/agenda-item',
  '/create/todo',
  '/create/statement',
  '/create/payment',
  '/create/election-candidate',
  '/create/blog-entry',
] as const;

test.describe('create/dashboard', () => {
  test('dashboard cards navigate to every create route @smoke', async ({ page }) => {
    test.setTimeout(90_000);

    for (const route of createRoutes) {
      await page.goto('/create');
      await expect(page.locator('[data-create-action="open-create-flow"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await page.locator(`[data-create-option="${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}`));
    }
  });

  test('auto layout preference renders a create flow @smoke', async ({ createFlowPage }) => {
    await createFlowPage.goto('/create/group', 'auto');
    await createFlowPage.expectLoaded('group');
  });
});
