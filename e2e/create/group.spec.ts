import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalGroup, gotoGroup, layouts, visibilityValues } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    name: ['empty', 'valid'],
    email: ['empty', 'valid', 'invalid'],
    groupType: ['base', 'hierarchical'],
    linkedGroup: ['absent', 'present'],
    location: ['absent', 'present'],
    visibility: visibilityValues,
    hashtags: ['absent', 'present'],
    invite: ['absent', 'user', 'csv'],
    constitutionalEvent: ['off', 'on'],
  },
  { max: matrixLimit(48), name: scenarioLabel }
);

test.describe('create/group', () => {
  test('creates a minimal group @smoke', async ({ createFlowPage, e2eRun }) => {
    await gotoGroup(createFlowPage);
    await fillMinimalGroup(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'group',
      prefix: e2eRun.prefix,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoGroup(createFlowPage, scenario.data.layout as 'one_page' | 'carousel');

      if (scenario.data.name === 'valid') {
        await createFlowPage.form.fillText('name', `${e2eRun.prefix} Matrix Group`, {
          optional: true,
        });
      }

      if (scenario.data.email === 'valid') {
        await createFlowPage.form.fillText('email', `${e2eRun.prefix}@example.test`, {
          optional: true,
        });
      } else if (scenario.data.email === 'invalid') {
        await createFlowPage.form.fillText('email', 'not-an-email', { optional: true });
      }

      await createFlowPage.form.chooseOption('group-type', scenario.data.groupType as string, {
        optional: true,
      });

      if (scenario.data.linkedGroup === 'present') {
        await createFlowPage.selectTypeahead('link-groups', seed.linkedGroupName, {
          entityType: 'group',
          optional: true,
        });
      }

      await createFlowPage.form.chooseOption('image-tags', scenario.data.visibility as string, {
        optional: true,
      });

      if (
        scenario.data.layout === 'one_page' &&
        (scenario.data.name === 'empty' || scenario.data.email === 'invalid')
      ) {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="group"]')).toBeVisible();
      }
    });
  }
});
