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
    dueDate: ['absent', 'date_only', 'with_time'],
    visibility: visibilityValues,
    tags: ['absent', 'present'],
  },
  { max: matrixLimit(48), name: scenarioLabel }
);

async function selectCurrentTodoDeadline(
  createFlowPage: Parameters<typeof gotoTodo>[0],
  options: { optional?: boolean } = {}
) {
  const field = createFlowPage.form.field('due-date-time');
  if (options.optional && (!(await field.count()) || !(await field.isVisible()))) return false;

  const localDateKey = await createFlowPage.page.evaluate(() => new Date().toLocaleDateString());
  await field.locator(`[data-day="${localDateKey}"]`).click();
  return true;
}

test.describe('create/todo', () => {
  test('creates a minimal todo @smoke', async ({ createFlowPage, e2eRun }) => {
    await gotoTodo(createFlowPage);
    await fillMinimalTodo(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'todo',
      prefix: e2eRun.prefix,
    });
  });

  test('creates a todo with an explicit local deadline time @create-full', async ({
    createFlowPage,
    e2eRun,
  }) => {
    await gotoTodo(createFlowPage, 'one_page');
    await fillMinimalTodo(createFlowPage, `${e2eRun.prefix} Timed`);
    await selectCurrentTodoDeadline(createFlowPage);
    await createFlowPage.form.field('due-date-time').locator('input[type="time"]').fill('14:30');
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'todo',
      prefix: `${e2eRun.prefix} Timed`,
    });

    await createFlowPage.page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(createFlowPage.page).toHaveURL(/\/todos\/[0-9a-f-]+\/?$/);

    const comment = `${e2eRun.prefix} Todo comment`;
    const commentInput = createFlowPage.page.getByPlaceholder('Add a comment...').first();
    await expect(commentInput).toBeVisible({ timeout: 60_000 });
    await commentInput.fill(comment);
    await commentInput.press('Control+Enter');
    await expect(createFlowPage.page.getByText(comment, { exact: true })).toBeVisible();
  });

  test('archives and restores a completed todo @create-full', async ({
    createFlowPage,
    e2eRun,
  }) => {
    const prefix = `${e2eRun.prefix} Archive`;
    const title = `${prefix} Created Todo`;

    await gotoTodo(createFlowPage, 'one_page');
    await fillMinimalTodo(createFlowPage, prefix);
    await createFlowPage.form.chooseOption('status', 'completed');
    await submitSmokeAndExpectCreated(createFlowPage, { kind: 'todo', prefix });

    await createFlowPage.page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(createFlowPage.page).toHaveURL(/\/todos\/[0-9a-f-]+\/?$/);

    await createFlowPage.page.getByRole('button', { name: 'Archive', exact: true }).click();
    await createFlowPage.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Archive', exact: true })
      .click();

    await createFlowPage.page.goto('/todos');
    await createFlowPage.page.getByRole('tab', { name: /Archived/ }).click();
    await expect(createFlowPage.page.getByText(title, { exact: true })).toBeVisible();

    await createFlowPage.page.getByText(title, { exact: true }).click();
    const dialog = createFlowPage.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Restore', exact: true }).click();
    await dialog.getByRole('button', { name: 'Close' }).click();

    await createFlowPage.page.getByRole('tab', { name: /Completed/ }).click();
    await expect(createFlowPage.page.getByText(title, { exact: true })).toBeVisible();
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

      if (scenario.data.dueDate !== 'absent') {
        await selectCurrentTodoDeadline(createFlowPage, { optional: true });
      }
      if (scenario.data.dueDate === 'with_time') {
        const field = createFlowPage.form.field('due-date-time');
        const timeInput = field.locator('input[type="time"]');
        if ((await timeInput.count()) && (await timeInput.isVisible())) {
          await timeInput.fill('14:30');
        }
      }

      if (scenario.data.layout === 'one_page' && scenario.data.title === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="todo"]')).toBeVisible();
      }
    });
  }
});
