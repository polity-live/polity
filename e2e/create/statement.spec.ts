import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalStatement, gotoStatement, layouts, visibilityValues } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    content: ['empty', 'title', 'text', 'image', 'video', 'title-text'],
    group: ['absent', 'present'],
    story: ['off', 'on'],
    survey: ['absent', 'valid', 'invalid'],
    hashtags: ['absent', 'present'],
    visibility: visibilityValues,
  },
  { max: matrixLimit(48), name: scenarioLabel }
);

test.describe('create/statement', () => {
  test('creates a minimal statement @smoke', async ({ createFlowPage, e2eRun }) => {
    await gotoStatement(createFlowPage);
    await fillMinimalStatement(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'statement',
      prefix: e2eRun.prefix,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoStatement(createFlowPage, scenario.data.layout as 'one_page' | 'carousel');

      if (scenario.data.content === 'title' || scenario.data.content === 'title-text') {
        await createFlowPage.form.fillText('title', `${e2eRun.prefix} Statement Title`, {
          optional: true,
        });
      }
      if (scenario.data.content === 'text' || scenario.data.content === 'title-text') {
        await createFlowPage.form.fillText('text', `${e2eRun.prefix} Statement text`, {
          optional: true,
        });
      }
      if (scenario.data.group === 'present') {
        await createFlowPage.selectTypeahead('group', seed.groupName, {
          entityType: 'group',
          optional: true,
        });
      }
      await createFlowPage.form.setChecked('story', scenario.data.story === 'on', {
        optional: true,
      });
      await createFlowPage.form.chooseOption('visibility', scenario.data.visibility as string, {
        optional: true,
      });

      if (scenario.data.layout === 'one_page' && scenario.data.content === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="statement"]')).toBeVisible();
      }
    });
  }
});
