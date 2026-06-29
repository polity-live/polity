import { test, expect } from '../fixtures/test';
import {
  clearCreateRecoverySessionStateForPage,
  waitForCreateDashboardReady,
} from '../fixtures/create-flow-page';

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
  test.beforeEach(async ({ page }) => {
    await clearCreateRecoverySessionStateForPage(page);
  });

  test('dashboard cards navigate to every create route @smoke', async ({ page }) => {
    for (const route of createRoutes) {
      await page.goto('/create');
      await waitForCreateDashboardReady(page);
      await page.locator(`[data-create-option="${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}`));
    }
  });

  test('auto layout preference renders a create flow @smoke', async ({ createFlowPage }) => {
    await createFlowPage.goto('/create/group', 'auto');
    await createFlowPage.expectLoaded('group');
  });
});
