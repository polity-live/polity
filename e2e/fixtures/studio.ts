import { expect, type Page } from '@playwright/test';
import { waitForAppReady } from './readiness';

export async function createStudioProject(page: Page, title: string): Promise<string> {
  const obsoleteRequests: string[] = [];
  const record = (request: { url(): string }) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/studio' || path.startsWith('/api/studio/read/')) obsoleteRequests.push(path);
  };
  page.on('request', record);
  try {
    await page.goto('/create/studio-project', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page
      .locator('[data-create-action="set-form-style"][data-create-option="one_page"]')
      .click();
    await page.getByRole('textbox', { name: /^Title(?:\s*\*)?$/ }).fill(title);
    await page.locator('[data-create-action="submit"]').click();
    await expect(page).toHaveURL(/\/studio\/[a-f0-9-]{36}\/?$/, { timeout: 60_000 });
    expect(obsoleteRequests).toEqual([]);
    return new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!;
  } finally {
    page.off('request', record);
  }
}
