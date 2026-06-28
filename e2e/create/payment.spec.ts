import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalPayment, gotoPayment, layouts } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    label: ['empty', 'valid'],
    amount: ['empty', 'valid-zero', 'valid-positive', 'invalid-negative'],
    direction: ['income', 'expense'],
    type: ['membership_fee', 'donation', 'subsidies', 'campaign', 'material', 'events', 'others'],
    group: ['empty', 'valid'],
    counterparty: ['empty', 'valid'],
  },
  { max: matrixLimit(64), name: scenarioLabel }
);

test.describe('create/payment', () => {
  test('creates a minimal payment @smoke', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoPayment(createFlowPage, seed, 'one_page', true, 'income');
    await fillMinimalPayment(createFlowPage, seed, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'payment',
      prefix: e2eRun.prefix,
      seed,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoPayment(
        createFlowPage,
        seed,
        scenario.data.layout as 'one_page' | 'carousel',
        scenario.data.group === 'valid',
        scenario.data.direction as 'income' | 'expense'
      );

      if (scenario.data.label === 'valid') {
        await createFlowPage.form.fillText('label', `${e2eRun.prefix} Matrix Payment`, {
          optional: true,
        });
      }

      const amount =
        scenario.data.amount === 'valid-zero'
          ? '0'
          : scenario.data.amount === 'valid-positive'
            ? '25.50'
            : scenario.data.amount === 'invalid-negative'
              ? '-10'
              : '';
      if (amount) await createFlowPage.form.fillText('amount', amount, { optional: true });

      await createFlowPage.form.chooseOption('direction', scenario.data.direction as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('type', scenario.data.type as string, {
        optional: true,
      });

      if (scenario.data.group === 'valid' && scenario.data.counterparty === 'valid') {
        await createFlowPage.selectTypeahead('entity-user', 'E2E', {
          entityType: 'user',
          optional: true,
        });
      }

      if (
        scenario.data.layout === 'one_page' &&
        (scenario.data.label === 'empty' ||
          scenario.data.amount === 'empty' ||
          scenario.data.amount === 'invalid-negative' ||
          scenario.data.group === 'empty' ||
          scenario.data.counterparty === 'empty')
      ) {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="payment"]')).toBeVisible();
      }
    });
  }
});
