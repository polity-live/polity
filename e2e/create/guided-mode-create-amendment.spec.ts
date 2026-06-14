import { test, expect } from '../fixtures/test-base';
test.describe('Create Feature', () => {
  test('Guided Mode - Create Amendment', async ({ authenticatedPage: page }) => {
    const mutationErrors: string[] = [];
    const permissionErrorPattern = /Permission denied|documents\.updateContent/i;

    page.on('console', message => {
      const text = message.text();
      if (permissionErrorPattern.test(text)) {
        mutationErrors.push(text);
      }
    });
    page.on('pageerror', error => {
      const text = error.message;
      if (permissionErrorPattern.test(text)) {
        mutationErrors.push(text);
      }
    });

    await page.goto('/create/amendment');

    // Step 0: Title + Subtitle
    const titleInput = page.getByRole('textbox', { name: /amendment title/i });
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('Climate Action Amendment 2024');

    const subtitleInput = page.getByRole('textbox', { name: /subtitle/i });
    if (await subtitleInput.isVisible()) {
      await subtitleInput.fill('An amendment to address climate change policies');
    }

    const nextButton = page.getByRole('button', { name: 'Next', exact: true });

    // Step 0→1 (Target Group & Event - required fields)
    await nextButton.click();

    // Step 1 requires group + event selection
    // Try to navigate through remaining steps if validation allows
    // Steps: 1→2→3→4 (3 more clicks to reach review)
    for (let i = 0; i < 3; i++) {
      if (await nextButton.isEnabled()) {
        await nextButton.click();
      }
    }

    // The review step should expose the final create action.
    const createButton = page.locator('main').getByRole('button', { name: /^create$/i });
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();
    await page.waitForURL(/\/amendment\/[^/]+/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    expect(mutationErrors).toEqual([]);
    expect(page.url()).toMatch(/\/amendment\/[^/]+/);
  });
});
