// spec: e2e/test-plans/magic-link-auth-test-plan.md
// seed: e2e/seed.spec.ts

import { expect, test } from '../fixtures/test-base';

test.describe('Password Sign-In Email Validation', () => {
  test('disables sign-in actions until the email format is valid', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByRole('heading', { name: 'Sign in to Polity' }).waitFor({ state: 'visible' });

    const emailInput = page.getByRole('textbox', { name: 'Email address' });
    const passwordInput = page.getByLabel(/^Password$/);
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    const sendCodeButton = page.getByRole('button', { name: 'Send magic code' });

    await emailInput.fill('invalid-email');

    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(signInButton).toBeDisabled();
    await expect(sendCodeButton).toBeDisabled();

    await emailInput.fill('polity.live@gmail.com');

    await expect(emailInput).not.toHaveAttribute('aria-invalid', 'true');
    await expect(sendCodeButton).toBeEnabled();

    await passwordInput.fill('secret1');

    await expect(signInButton).toBeEnabled();
  });
});
