// spec: e2e/test-plans/profile-feature-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';
import { navigateToProfileEdit } from '../helpers/navigation';

test.describe('Avatar Management', () => {
  test('Access Avatar Upload Interface', async ({ authenticatedPage: page }) => {
    await navigateToProfileEdit(page);

    const uploadCard = page.locator('[data-testid="image-upload"]').first();
    const dropzone = page.locator('[data-testid="image-upload-dropzone"]').first();
    const fileInput = page.locator('[data-testid="image-upload-input"]').first();

    await expect(uploadCard).toBeVisible();
    await expect(dropzone).toBeVisible();
    await expect(fileInput).toBeAttached();

    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toMatch(/image/);
  });
});
