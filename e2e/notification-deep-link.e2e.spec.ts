import { expect, test } from './fixtures/test';
import {
  cleanupCommunicationFlow,
  installCommunicationBoundaryFakes,
  seedNotificationFlow,
} from './fixtures/domains/communications';
import { db } from './fixtures/db';

test('opens a persisted notification deep link and saves its read state @pr', async ({
  e2eRun,
  page,
  seed,
}) => {
  await installCommunicationBoundaryFakes(page);
  const fixture = await seedNotificationFlow(e2eRun.prefix, seed.userId, `/group/${seed.groupId}`);
  try {
    await page.goto('/notifications');
    await page.getByRole('link', { name: fixture.title }).click();
    await expect(page).toHaveURL(new RegExp(`/group/${seed.groupId}(?:[/?#]|$)`));
    await expect(page.getByText(seed.groupName, { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await db()`
          select coalesce(is_read, false) as is_read
          from public.notification
          where id = ${fixture.notificationId}::uuid
        `;
        return rows[0]?.is_read;
      })
      .toBe(true);
  } finally {
    await cleanupCommunicationFlow({ notificationId: fixture.notificationId });
  }
});
