// spec: e2e/test-plans/magic-link-auth-test-plan.md
// seed: e2e/seed.spec.ts

import { expect, test } from '../fixtures/test-base';

test.describe('Password Sign-Up Live Validation', () => {
  test('keeps sign-up disabled until all fields are valid', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await page.getByRole('heading', { name: 'Create your account' }).waitFor({ state: 'visible' });

    const emailInput = page.getByRole('textbox', { name: 'Email address' });
    const passwordInput = page.getByLabel(/^Password$/);
    const confirmPasswordInput = page.getByLabel(/^Confirm password$/);
    const createAccountButton = page.getByRole('button', { name: 'Create account' });

    await emailInput.fill('invalid-email');
    await passwordInput.fill('short');
    await confirmPasswordInput.fill('mismatch');

    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    await expect(confirmPasswordInput).toHaveAttribute('aria-invalid', 'true');
    await expect(createAccountButton).toBeDisabled();

    await emailInput.fill('new.user@example.com');
    await passwordInput.fill('secret1');
    await confirmPasswordInput.fill('secret1');

    await expect(emailInput).not.toHaveAttribute('aria-invalid', 'true');
    await expect(passwordInput).not.toHaveAttribute('aria-invalid', 'true');
    await expect(confirmPasswordInput).not.toHaveAttribute('aria-invalid', 'true');
    await expect(createAccountButton).toBeEnabled();
  });
});