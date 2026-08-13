import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { seedAgendaSequence } from './fixtures/domains/governance';

test('starts an event, advances agenda items, and restores runtime state @pr @critical @acceptance', async ({
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const [nextItem] = await seedAgendaSequence(sql, e2eRun, seed, ['Second decision']);

  await page.goto(`/event/${seed.eventId}/agenda/${seed.agendaItemId}`);
  await waitForAppReady(page);
  await page.locator('[data-action-id="agendas.toolbar.item.start"]').click();

  await expect
    .poll(async () => {
      const rows = await sql`
        select status from public.agenda_item where id = ${seed.agendaItemId}::uuid
      `;
      return rows[0]?.status ?? null;
    })
    .toMatch(/^(active|in-progress)$/);

  const activationToast = page
    .getByRole('region', { name: /Notifications/i })
    .getByRole('listitem')
    .filter({ hasText: seed.agendaItemTitle });
  await activationToast.getByRole('button', { name: 'Close toast' }).click();
  await expect(activationToast).toBeHidden();

  await page.locator('[data-action-id="agendas.toolbar.item.complete"]').click();
  await expect
    .poll(async () => {
      const rows = await sql`
        select status from public.agenda_item where id = ${seed.agendaItemId}::uuid
      `;
      return rows[0]?.status ?? null;
    })
    .toBe('completed');

  const completionToast = page
    .getByRole('region', { name: /Notifications/i })
    .getByRole('listitem')
    .filter({ hasText: seed.agendaItemTitle });
  await completionToast.getByRole('button', { name: 'Close toast' }).click();
  await expect(completionToast).toBeHidden();

  await page.getByRole('link', { name: 'Back to agenda' }).click();
  const nextAgendaCard = page.locator(`[data-agenda-item-id="${nextItem!.id}"]`);
  await expect(nextAgendaCard).toBeVisible();
  await nextAgendaCard.locator('[data-link-surface-primary]').click();
  await expect(page).toHaveURL(new RegExp(`/agenda/${nextItem!.id}(?:$|[?#])`));
  await page.locator('[data-action-id="agendas.toolbar.item.start"]').click();

  await expect
    .poll(async () => {
      const rows = await sql`
        select status from public.agenda_item where id = ${nextItem!.id}::uuid
      `;
      return rows[0]?.status ?? null;
    })
    .toMatch(/^(active|in-progress)$/);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page.locator('[data-action-id="agendas.toolbar.item.complete"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: nextItem!.title, exact: true })).toBeVisible();
});
