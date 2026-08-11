import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { gotoReady } from './fixtures/domains/groups';

test('filters calendars and preserves the event subscription across reload @nightly @mobile', async ({
  page,
  seed,
}) => {
  await db()`
    delete from public.subscriber
    where subscriber_id = ${seed.userId}::uuid and event_id = ${seed.eventId}::uuid
  `;
  await gotoReady(page, `/group/${seed.groupId}/events`);
  const listView = page.getByRole('tab', { name: /list/i });
  await expect(listView).toBeVisible();
  await listView.click();
  const search = page.locator('input[placeholder*="Search" i]:visible');
  await expect(search).toBeVisible();
  await search.fill(seed.eventTitle);
  const eventCard = page
    .locator('[data-action-id="timeline.event.open"]')
    .filter({ hasText: seed.eventTitle });
  await expect(eventCard).toBeVisible({ timeout: 30_000 });
  await eventCard.click();
  await expect(page).toHaveURL(new RegExp(`/event/${seed.eventId}`));
  await page.locator('[data-action-id="events.subscribe.toggle"]').click();

  await expect
    .poll(async () => {
      const rows = await db()`
        select count(*)::int as count from public.subscriber
        where subscriber_id = ${seed.userId}::uuid and event_id = ${seed.eventId}::uuid
      `;
      return rows[0]?.count ?? 0;
    })
    .toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-action-id="events.subscribe.toggle"]')).toContainText(
    /unsubscribe/i
  );
});
