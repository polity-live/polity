import { test, expect } from '../fixtures/test';
import { fillMinimalTodo, gotoTodo } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

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
  test('creates a minimal todo @nightly', async ({ createFlowPage, e2eRun }) => {
    await gotoTodo(createFlowPage);
    await fillMinimalTodo(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'todo',
      prefix: e2eRun.prefix,
    });
  });

  test('creates a todo with an explicit local deadline time @nightly', async ({
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
    const commentInput = createFlowPage.page
      .getByPlaceholder('Add a comment...')
      .filter({ visible: true });
    await expect(commentInput).toHaveCount(1, { timeout: 60_000 });
    await commentInput.fill(comment);
    await commentInput.press('Control+Enter');
    await expect(createFlowPage.page.getByText(comment, { exact: true })).toBeVisible();
  });

  test('archives and restores a completed todo @nightly', async ({ createFlowPage, e2eRun }) => {
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
});
