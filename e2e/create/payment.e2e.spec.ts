import { test } from '../fixtures/test';
import { fillMinimalPayment, gotoPayment } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/payment', () => {
  test('creates a minimal payment @nightly', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoPayment(createFlowPage, seed, 'one_page', true, 'income');
    await fillMinimalPayment(createFlowPage, seed, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'payment',
      prefix: e2eRun.prefix,
      seed,
    });
  });
});
