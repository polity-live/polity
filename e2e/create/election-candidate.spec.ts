import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalElectionCandidate, gotoElectionCandidate, layouts } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    election: ['empty', 'valid'],
    statement: ['absent', 'present'],
    image: ['absent', 'present'],
  },
  { max: matrixLimit(24), name: scenarioLabel }
);

test.describe('create/election-candidate', () => {
  test('creates a minimal election candidate @smoke', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoElectionCandidate(createFlowPage);
    await fillMinimalElectionCandidate(createFlowPage, seed, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'electionCandidate',
      prefix: e2eRun.prefix,
      seed,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoElectionCandidate(createFlowPage, scenario.data.layout as 'one_page' | 'carousel');

      if (scenario.data.election === 'valid') {
        await createFlowPage.selectTypeahead('election', seed.electionTitle, {
          entityType: 'election',
          optional: true,
        });
      }
      if (scenario.data.statement === 'present') {
        await createFlowPage.form.fillText('statement', `${e2eRun.prefix} candidate statement`, {
          optional: true,
        });
      }

      if (scenario.data.layout === 'one_page' && scenario.data.election === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="election"]')).toBeVisible();
      }
    });
  }
});
