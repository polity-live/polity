import { expect, test } from './fixtures/test';
import { installPaymentBoundaryFakes } from './fixtures/domains/payments';

test('uses a local Stripe checkout and opens the synchronized portal @nightly', async ({
  page,
}) => {
  const ledger = await installPaymentBoundaryFakes(page);
  await page.goto('/pricing');
  await expect(page.locator('body')).toBeVisible();

  await page.goto('https://checkout.stripe.test/session/e2e');
  await expect(page.getByRole('heading', { name: 'Local Stripe checkout' })).toBeVisible();
  await page.getByRole('link', { name: 'Open billing portal' }).click();
  await expect(page.getByRole('heading', { name: 'Local Stripe billing portal' })).toBeVisible();
  await expect(page.getByText('Subscription active')).toBeVisible();
  expect(ledger).toEqual({ checkoutVisits: 1, portalVisits: 1 });
});
