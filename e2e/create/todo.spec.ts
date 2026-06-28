import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalTodo, gotoTodo, layouts, visibilityValues } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    title: ['empty', 'valid'],
    description: ['absent', 'present'],
    group: ['absent', 'present'],
    assignee: ['absent', 'present'],
    priority: ['low', 'medium', 'high'],
    status: ['pending', 'in_progress', 'completed'],
    dueDate: ['absent', 'present'],
    visibility: visibilityValues,
    tags: ['absent', 'present'],
  },
  { max: matrixLimit(48), name: scenarioLabel }
);

test.describe('create/todo', () => {
  test('creates a minimal todo @smoke', async ({ createFlowPage, e2eRun }) => {
    await gotoTodo(createFlowPage);
    await fillMinimalTodo(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'todo',
      prefix: e2eRun.prefix,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoTodo(createFlowPage, scenario.data.layout as 'one_page' | 'carousel');

      if (scenario.data.title === 'valid') {
        await createFlowPage.form.fillText('title', `${e2eRun.prefix} Matrix Todo`, {
          optional: true,
        });
      }
      if (scenario.data.description === 'present') {
        await createFlowPage.form.fillText('description', `${e2eRun.prefix} todo description`, {
          optional: true,
        });
      }
      if (scenario.data.group === 'present') {
        await createFlowPage.selectTypeahead('group', seed.groupName, {
          entityType: 'group',
          optional: true,
        });
      }
      if (scenario.data.assignee === 'present') {
        await createFlowPage.selectTypeahead('assignee', e2eRun.prefix, {
          entityType: 'user',
          optional: true,
        });
      }
      await createFlowPage.form.chooseOption('priority', scenario.data.priority as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('status', scenario.data.status as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('visibility', scenario.data.visibility as string, {
        optional: true,
      });

      if (scenario.data.layout === 'one_page' && scenario.data.title === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="todo"]')).toBeVisible();
      }
    });
  }
});
