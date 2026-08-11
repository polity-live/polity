import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { eventActors, resetEventParticipant } from './fixtures/domains/events';
import { gotoReady, openGroupActorPage } from './fixtures/domains/groups';

test('participant is invited, accepts, and remains in the persisted participant list @pr', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const participant = e2eRun.actor(eventActors.participant);
  const participantHandle = `e2e-${participant.id.slice(0, 8)}`;
  const actorPage = await openGroupActorPage(browser, participant);
  await resetEventParticipant(seed.eventId, participant.id);
  try {
    await gotoReady(page, `/event/${seed.eventId}/participants`);
    await page.locator('[data-action-id="groups.invitations.open.members-dialog"]').click();
    const dialog = page.getByRole('dialog');
    const search = dialog.getByRole('textbox', { name: /^Search/i });
    await search.fill(participantHandle);
    const result = dialog.locator('[data-typeahead-result]').filter({ hasText: participantHandle });
    await expect(result).toHaveCount(1, { timeout: 30_000 });
    await result.click();
    await dialog.locator('[data-action-id="groups.invitations.dialog.submit"]').click();
    await expect
      .poll(async () => {
        const rows = await db()`
          select status from public.event_participant
          where event_id = ${seed.eventId}::uuid and user_id = ${participant.id}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('invited');

    await gotoReady(actorPage.page, `/event/${seed.eventId}`);
    await actorPage.page
      .locator('[data-action-id="events.participation.accept-invitation"]')
      .click();
    await expect
      .poll(async () => {
        const rows = await db()`
          select status from public.event_participant
          where event_id = ${seed.eventId}::uuid and user_id = ${participant.id}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toMatch(/^(active|confirmed)$/);
    await gotoReady(page, `/event/${seed.eventId}/participants`);
    const participantRow = page.locator('tr').filter({ hasText: `@${participantHandle}` });
    await expect(participantRow).toBeVisible({ timeout: 30_000 });
  } finally {
    await actorPage.close();
  }
});
