import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { seedAgendaSequence } from './fixtures/domains/governance';

test('reorders agenda items and persists the sequence after reload @pr', async ({
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const items = await seedAgendaSequence(sql, e2eRun, seed, ['Housing', 'Budget']);

  await page.goto(`/event/${seed.eventId}/agenda`);
  await waitForAppReady(page);

  const budget = page.locator(`[data-agenda-item-id="${items[1]!.id}"]`);
  const budgetHandle = budget.locator('[data-action-id="agendas.event-agenda.item.drag"]');
  const firstDropTarget = page.locator(`[data-agenda-drop-id="${seed.agendaItemId}"]`);
  await firstDropTarget.scrollIntoViewIfNeeded();
  await budgetHandle.scrollIntoViewIfNeeded();
  const sourceBox = await budgetHandle.boundingBox();
  const targetBox = await firstDropTarget.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Agenda drag source or drop target is not visible');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 4, {
    steps: 20,
  });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const rows = await sql`
        select id::text, order_index
        from public.agenda_item
        where id in (
          ${seed.agendaItemId}::uuid,
          ${items[0]!.id}::uuid,
          ${items[1]!.id}::uuid
        )
        order by order_index, id
      `;
      return rows.map(row => row.id);
    })
    .toEqual([items[1]!.id, seed.agendaItemId, items[0]!.id]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect
    .poll(async () =>
      page
        .locator('[data-agenda-item-id]')
        .evaluateAll(nodes =>
          nodes.slice(0, 3).map(node => node.getAttribute('data-agenda-item-id'))
        )
    )
    .toEqual([items[1]!.id, seed.agendaItemId, items[0]!.id]);
});
