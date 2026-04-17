// spec: e2e/test-plans/magic-link-auth-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';
test.describe('Email Entry and Magic Code Request', () => {
  test('Validate Email Format (Invalid Email)', async ({ page }) => {
    // 1. Navigate to /auth
    await page.goto('/auth');
    await page.getByText('Sign in to Polity').first().waitFor({ state: 'visible' });

    // 2. Locate email input field
    const emailInput = page.getByRole('textbox', { name: 'Email address' });

    // 3. Enter invalid email: invalid-email (no @ symbol)
    await emailInput.fill('invalid-email');

    // 4. Locate submit button
    const sendButton = page.getByRole('button', { name: 'Send magic code' });

    // 5. Verify invalid email keeps the submit action disabled
    await expect(sendButton).toBeDisabled();
  });
});
