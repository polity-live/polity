import { expect, test } from './fixtures/test';
import { installCommunicationBoundaryFakes } from './fixtures/domains/communications';

test('subscribes, sends a local test push, and unsubscribes @nightly @mobile', async ({
  page,
  e2eUser,
}) => {
  const ledger = await installCommunicationBoundaryFakes(page);
  await page.goto(`/user/${e2eUser.id}/notification-settings`);
  const result = await page.evaluate(async () => {
    const subscription = await fetch('/api/push/subscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.test/local', auth: 'auth', p256dh: 'p256dh' }),
    });
    const delivery = await fetch('/api/push/test', { method: 'POST' });
    const unsubscribe = await fetch('/api/push/subscription', { method: 'DELETE' });
    return {
      subscribed: subscription.ok,
      delivered: delivery.ok,
      unsubscribed: unsubscribe.ok,
    };
  });
  expect(result).toEqual({ subscribed: true, delivered: true, unsubscribed: true });
  expect(ledger).toMatchObject({ pushSubscriptions: 2, pushDeliveries: 1 });
});
