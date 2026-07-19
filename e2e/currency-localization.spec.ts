import { test, expect } from './fixtures/test';

test.describe('currency localization', () => {
  test('persists the display currency and uses it as payment default', async ({
    page,
    e2eUser,
  }) => {
    const currencySelector = () =>
      page.getByRole('combobox', { name: /display currency|anzeigewährung/i });

    await page.goto(`/user/${e2eUser.id}/settings?tab=preferences`);
    await expect(currencySelector()).toBeVisible();

    try {
      await currencySelector().click();
      await page.getByText(/\(USD\)$/).click();
      await expect(currencySelector()).toContainText('USD');

      await page.reload();
      await expect(currencySelector()).toContainText('USD');

      await page.goto('/create/payment');
      await expect(
        page.getByRole('combobox', { name: /display currency|anzeigewährung/i })
      ).toContainText('USD');
    } finally {
      await page.goto(`/user/${e2eUser.id}/settings?tab=preferences`);
      await currencySelector().click();
      await page.getByText(/\(EUR\)$/).click();
      await expect(currencySelector()).toContainText('EUR');
    }
  });
});
