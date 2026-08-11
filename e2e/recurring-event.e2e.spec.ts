import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { fillMinimalEvent, gotoEvent } from './create/helpers';
import { submitSmokeAndExpectCreated } from './create/smoke-expectations';

test('creates a weekly recurring event and persists generated series fields @pr', async ({
  createFlowPage,
  e2eRun,
  seed,
}) => {
  await gotoEvent(createFlowPage, seed, 'one_page', {
    eventType: 'open',
    withGroup: true,
    time: 'valid',
  });
  await fillMinimalEvent(createFlowPage, e2eRun.prefix);
  await createFlowPage.form.chooseOption('recurring', 'weekly');
  const weekday = createFlowPage.page
    .locator('[data-create-field="recurring"] [data-create-option="1"]')
    .filter({ visible: true });
  await expect(weekday).toBeVisible();
  await weekday.click();
  await submitSmokeAndExpectCreated(createFlowPage, {
    kind: 'event',
    prefix: e2eRun.prefix,
  });

  const rows = await db()`
    select is_recurring, recurrence_pattern, recurrence_rule
    from public.event
    where title = ${`${e2eRun.prefix} Created Event`}
    limit 1
  `;
  expect(rows[0]).toMatchObject({ is_recurring: true, recurrence_pattern: 'weekly' });
  expect(String(rows[0]?.recurrence_rule)).toContain('FREQ=WEEKLY');
});
