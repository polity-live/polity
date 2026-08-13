import { expect, test } from './fixtures/test';
import { signInThroughUi, signOutThroughUserMenu } from './fixtures/auth-flow-page';

test('restores an unauthenticated protected deep link after login @pr @agent1-promotion', async ({
  page,
  e2eUser,
}) => {
  const target = `/user/${e2eUser.id}/settings?tab=preferences#currency`;
  await page.goto('/home');
  await signOutThroughUserMenu(page);

  await page.goto(target);
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await signInThroughUi(page, e2eUser, new RegExp(`/user/${e2eUser.id}/settings$`));

  await expect(page).toHaveURL(
    new RegExp(`/user/${e2eUser.id}/settings\\?tab=preferences#currency$`)
  );
  await expect(page.getByRole('tab', { name: /appearance|darstellung/i })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(
    page.getByRole('heading', { name: /display currency|anzeigewährung/i })
  ).toBeVisible();
});
