import { expect, test } from './fixtures/test';
import { signInThroughUi, signOutThroughUserMenu } from './fixtures/auth-flow-page';

test('restores an unauthenticated protected deep link after login @pr', async ({
  page,
  e2eUser,
}) => {
  const target = `/user/${e2eUser.id}/settings?tab=preferences`;
  await page.goto('/home');
  await signOutThroughUserMenu(page);

  await page.goto(target);
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await signInThroughUi(page, e2eUser, new RegExp(`/user/${e2eUser.id}/settings$`));

  await expect(page).toHaveURL(new RegExp(`/user/${e2eUser.id}/settings\\?tab=preferences$`));
  await expect(page.getByRole('heading', { name: /preferences|einstellungen/i })).toBeVisible();
});
