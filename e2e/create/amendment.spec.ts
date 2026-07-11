import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalAmendment, gotoAmendment, layouts, visibilityValues } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    title: ['empty', 'valid'],
    subtitle: ['absent', 'present'],
    media: ['absent', 'url'],
    target: ['absent', 'group', 'group-event'],
    evaluation: ['none', 'fixed_date', 'relative_to_vote'],
    visibility: visibilityValues,
    hashtags: ['absent', 'present'],
  },
  { max: matrixLimit(48), name: scenarioLabel }
);

test.describe('create/amendment', () => {
  test('creates a targeted amendment @smoke', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoAmendment(createFlowPage);
    await fillMinimalAmendment(createFlowPage, e2eRun.prefix);
    await createFlowPage.selectTypeahead('target', seed.groupName, {
      entityType: 'group',
    });
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'amendment',
      prefix: e2eRun.prefix,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoAmendment(createFlowPage, scenario.data.layout as 'one_page' | 'carousel');

      if (scenario.data.title === 'valid') {
        await createFlowPage.form.fillText('title', `${e2eRun.prefix} Matrix Amendment`, {
          optional: true,
        });
      }

      if (scenario.data.subtitle === 'present') {
        await createFlowPage.form.fillText('subtitle', `${e2eRun.prefix} subtitle`, {
          optional: true,
        });
      }

      if (scenario.data.target !== 'absent') {
        await createFlowPage.selectTypeahead('target', seed.groupName, {
          entityType: 'group',
          optional: true,
        });
      }

      await createFlowPage.form.chooseOption('mode', scenario.data.evaluation as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('visibility', scenario.data.visibility as string, {
        optional: true,
      });

      if (scenario.data.layout === 'one_page' && scenario.data.title === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="amendment"]')).toBeVisible();
      }
    });
  }
});
