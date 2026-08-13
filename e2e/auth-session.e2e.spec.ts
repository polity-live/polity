import { expect, test } from './fixtures/test';
import { signInThroughUi, signOutThroughUserMenu } from './fixtures/auth-flow-page';
import { waitForAppReady } from './fixtures/readiness';

test('signs in, reloads a protected page and signs out @pr @critical @acceptance @agent1-promotion', async ({
  page,
  e2eUser,
}) => {
  await page.goto('/notifications');
  await waitForAppReady(page);
  await page.reload();
  await waitForAppReady(page);

  await signOutThroughUserMenu(page);
  await signInThroughUi(page, e2eUser, '/home');
  await page.goto('/notifications');
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/notifications$/);
  await signOutThroughUserMenu(page);
});
