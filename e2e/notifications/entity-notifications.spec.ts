import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test-base';
import { TEST_ENTITY_IDS } from '../test-entity-ids';

test.describe('Notifications - Entity-Scoped Notifications', () => {
  async function expectEntityNotificationsPage(page: Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('tab', { name: /^all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^unread/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^read/i })).toBeVisible();
  }

  test('Group notification tab loads', async ({ authenticatedPage: page }) => {
    await expectEntityNotificationsPage(page, `/group/${TEST_ENTITY_IDS.testGroup1}/notifications`);
  });

  test('Event notification tab loads', async ({ authenticatedPage: page }) => {
    await expectEntityNotificationsPage(page, `/event/${TEST_ENTITY_IDS.testEvent1}/notifications`);
  });

  test('Amendment notification tab loads', async ({ authenticatedPage: page }) => {
    await expectEntityNotificationsPage(
      page,
      `/amendment/${TEST_ENTITY_IDS.testAmendment1}/notifications`
    );
  });

  test('Blog notification tab loads', async ({ authenticatedPage: page }) => {
    await expectEntityNotificationsPage(page, `/blog/${TEST_ENTITY_IDS.testBlog1}/notifications`);
  });
});
