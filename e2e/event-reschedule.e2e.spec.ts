import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { seedEventParticipant } from './fixtures/domains/events';
import { gotoReady } from './fixtures/domains/groups';

test('reschedules an event, notifies the participant, and survives mobile reload @pr @mobile', async ({
  e2eRun,
  page,
  seed,
}) => {
  const participantId = await seedEventParticipant(
    e2eRun.prefix,
    seed.eventId,
    seed.groupId,
    seed.extraUserId
  );
  e2eRun.registerEntityId(participantId);
  await gotoReady(page, `/event/${seed.eventId}/settings`);
  const endTime = page.getByLabel(/end time/i);
  await expect(endTime).toBeVisible();
  await endTime.fill('21:00');
  await page.locator('[data-action-id="events.edit.save"]').click();

  await expect
    .poll(async () => {
      const rows = await db()`
        select type from public.notification
        where recipient_id = ${seed.extraUserId}::uuid
          and related_event_id = ${seed.eventId}::uuid
          and type = 'event_schedule_changed'
        order by created_at desc limit 1
      `;
      return rows[0]?.type ?? null;
    })
    .toBe('event_schedule_changed');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(endTime).toHaveValue('21:00');
});
