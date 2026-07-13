import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';

const virtualizerFailure =
  /getVirtualItems|InputValidationError|expected number to be <=\s*100|cannot read properties of undefined.*virtualizer/i;

const desktopRoutes = [
  ['/home', 'Timeline'],
  ['/search', 'Search'],
  ['/search?view=spatial', 'Search'],
  ['/messages', 'Messages'],
  ['/notifications', 'Notifications'],
  ['/calendar', 'Calendar'],
  ['/todos', 'My Todos'],
] as const;

function collectVirtualizerFailures(page: Page) {
  const failures: string[] = [];

  page.on('pageerror', (error: Error) => {
    if (virtualizerFailure.test(error.message)) failures.push(error.message);
  });
  page.on('console', (message: { type(): string; text(): string }) => {
    if (message.type() === 'error' && virtualizerFailure.test(message.text())) {
      failures.push(message.text());
    }
  });

  return failures;
}

test.describe('virtualized routes', () => {
  test('render the migrated desktop surfaces without virtualizer failures @smoke', async ({
    page,
  }) => {
    const failures = collectVirtualizerFailures(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const [route, marker] of desktopRoutes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/unauthorized(?:\?|$)/);
      await expect(page.locator('body')).toContainText(marker);
      await page.waitForTimeout(500);
    }

    expect(failures).toEqual([]);
  });

  test('keeps the responsive search grid stable on a mobile viewport @smoke', async ({ page }) => {
    const failures = collectVirtualizerFailures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/search');

    await expect(page).not.toHaveURL(/\/unauthorized(?:\?|$)/);
    await expect(page.locator('body')).toContainText('Search');
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(750);

    expect(failures).toEqual([]);
  });
});
