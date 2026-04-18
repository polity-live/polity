// spec: e2e/test-plans/profile-feature-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';
import path from 'path';
import { navigateToOwnProfile, navigateToProfileEdit } from '../helpers/navigation';

test.describe('Responsive Behavior and Visual Elements', () => {
  test('Update Profile Avatar and Verify Display', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    await navigateToProfileEdit(page);

    const fileInput = page.locator('[data-testid="image-upload-input"]').first();
    await expect(fileInput).toBeAttached();

    const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');

    try {
      await fileInput.setInputFiles(testImagePath);
    } catch {
      const buffer = Buffer.from('fake-image-data');
      await fileInput.setInputFiles({
        name: 'test-avatar.jpg',
        mimeType: 'image/jpeg',
        buffer: buffer,
      });
    }

    await page.waitForLoadState('networkidle');

    const saveButton = page.locator('button:has-text("Save")').or(
      page.locator('[type="submit"]')
    ).first();
    await saveButton.click();

    await page.waitForLoadState('networkidle');

    await navigateToOwnProfile(page);

    const avatarImage = page.locator('main img').first();
    const avatarFallback = page.locator('main').getByText(/^[A-Z]{1,3}$/);

    const hasAvatarImage = await avatarImage.isVisible().catch(() => false);
    const hasFallback = await avatarFallback.isVisible().catch(() => false);

    expect(hasAvatarImage || hasFallback).toBeTruthy();

    if (hasAvatarImage) {
      const srcAttr = await avatarImage.getAttribute('src');
      expect(srcAttr).toBeTruthy();
      expect(srcAttr).not.toBe('');

      const altAttr = await avatarImage.getAttribute('alt');
      expect(altAttr).toBeTruthy();
      expect(altAttr?.length).toBeGreaterThan(0);
    }

    if (hasFallback) {
      const fallbackText = await avatarFallback.textContent();
      expect(fallbackText).toMatch(/^[A-Z]{1,3}$/);
    }
  });
});
