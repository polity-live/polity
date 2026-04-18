// spec: e2e/test-plans/profile-feature-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';
import { navigateToProfileEdit } from '../helpers/navigation';

test.describe('Avatar Management', () => {
  test('Verify Avatar Upload Constraints', async ({ authenticatedPage: page }) => {
    await navigateToProfileEdit(page);

    const dropzone = page.locator('[data-testid="image-upload-dropzone"]').first();
    const fileInput = page.locator('[data-testid="image-upload-input"]').first();

    await expect(dropzone).toBeVisible();
    const acceptAttr = await fileInput.getAttribute('accept');

    expect(acceptAttr).toBeTruthy();
    expect(acceptAttr).toMatch(/image/);

    await expect(dropzone).toContainText(/drag|drop|browse/i);
  });
});
