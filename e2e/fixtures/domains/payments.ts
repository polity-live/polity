import type { Page } from '@playwright/test';

export interface PaymentBoundaryLedger {
  checkoutVisits: number;
  portalVisits: number;
}

export async function installPaymentBoundaryFakes(page: Page) {
  const ledger: PaymentBoundaryLedger = { checkoutVisits: 0, portalVisits: 0 };
  await page.route('https://checkout.stripe.test/**', async route => {
    ledger.checkoutVisits += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<main><h1>Local Stripe checkout</h1><a href="https://billing.stripe.test/portal">Open billing portal</a></main>',
    });
  });
  await page.route('https://billing.stripe.test/**', async route => {
    ledger.portalVisits += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<main><h1>Local Stripe billing portal</h1><p>Subscription active</p></main>',
    });
  });
  return ledger;
}
