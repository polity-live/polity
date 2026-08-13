import { expect, test } from '../fixtures/test';
import { db } from '../fixtures/db';
import { waitForAppReady } from '../fixtures/readiness';

test('starts an event and its first agenda item and restores both after reload @pr @critical', async ({
  page,
  seed,
}) => {
  const sql = db();

  await page.goto(`/event/${seed.eventId}/agenda/${seed.agendaItemId}`);
  await waitForAppReady(page);
  const start = page.locator('[data-action-id="agendas.toolbar.item.start"]');
  await expect(start).toBeEnabled();
  await start.click();

  await expect
    .poll(async () => {
      const [eventRows, itemRows] = await Promise.all([
        sql`select status from public.event where id = ${seed.eventId}::uuid`,
        sql`select status from public.agenda_item where id = ${seed.agendaItemId}::uuid`,
      ]);
      return `${eventRows[0]?.status}:${itemRows[0]?.status}`;
    })
    .toMatch(/^(active|in-progress):(active|in-progress)$/);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page.locator('[data-action-id="agendas.toolbar.item.complete"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: seed.agendaItemTitle, exact: true })
  ).toBeVisible();
});
