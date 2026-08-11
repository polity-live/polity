import { expect, type Page } from '@playwright/test';

import type { E2EActorUser } from './auth';
import { waitForAppReady } from './readiness';

export async function signOutThroughUserMenu(page: Page) {
  await page.locator('[data-action-id="navigation.user-menu.open"]:visible').click();
  await page.locator('[data-action-id="navigation.user-menu.logout-dialog.open"]:visible').click();
  await page.locator('[data-action-id="navigation.user-menu.logout.confirm"]:visible').click();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
}

export async function signInThroughUi(
  page: Page,
  user: E2EActorUser,
  expectedPath: string | RegExp = '/home'
) {
  const form = page.locator('form[data-action-id="auth.sign-in.submit.password"]');
  const email = form.locator('#email');
  const password = form.locator('#password');
  const submit = form.getByRole('button', { name: 'Sign in', exact: true });

  await expect(form).toBeVisible();
  await form.evaluate(async element => {
    const animations = new Set<Animation>();
    for (let current: Element | null = element; current; current = current.parentElement) {
      for (const animation of current.getAnimations()) animations.add(animation);
    }
    await Promise.all([...animations].map(animation => animation.finished.catch(() => undefined)));
  });

  await email.fill(user.email);
  await password.fill(user.password);
  await expect(email).toHaveValue(user.email);
  await expect(password).toHaveValue(user.password);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 90_000 }).toMatch(expectedPath);
  await waitForAppReady(page);
}

export async function finishOnboardingWithoutSelections(page: Page) {
  await page
    .locator('[data-slot="onboarding-action-bar"]')
    .getByRole('button', { name: 'Skip for now', exact: true })
    .click();
  await page
    .locator('[data-slot="onboarding-action-bar"]')
    .getByRole('button', { name: 'Continue without group', exact: true })
    .click();
  await page
    .locator('[data-slot="onboarding-action-bar"]')
    .getByRole('button', { name: 'Continue', exact: true })
    .click();
  await page
    .locator('[data-slot="onboarding-action-bar"]')
    .getByRole('button', { name: 'Continue to start', exact: true })
    .click();
}
