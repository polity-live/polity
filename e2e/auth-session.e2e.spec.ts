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

  // Hold the real logout request until we verify that the old session cannot
  // expose a sign-in form which its eventual removal would remount and clear.
  let releaseLogout!: () => void;
  const logoutReleased = new Promise<void>(resolve => (releaseLogout = resolve));
  const logoutUrl = /\/auth\/v1\/logout(?:\?|$)/;
  await page.route(logoutUrl, async route => {
    await logoutReleased;
    await route.continue();
  });
  const logoutObserved = page.waitForRequest(logoutUrl);
  const signOut = signOutThroughUserMenu(page);
  try {
    await logoutObserved;
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.locator('form[data-action-id="auth.sign-in.submit.password"]')).toHaveCount(
      0
    );
  } finally {
    releaseLogout();
    await signOut;
    await page.unroute(logoutUrl);
  }
  await signInThroughUi(page, e2eUser, '/home');
  await page.goto('/notifications');
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/notifications$/);
  await signOutThroughUserMenu(page);
});
