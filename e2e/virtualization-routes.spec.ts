import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';

const virtualizerFailure =
  /getVirtualItems|InputValidationError|expected number to be <=\s*100|cannot read properties of undefined.*virtualizer/i;
const configuredSearchScrollBudget = Number(process.env.SEARCH_SCROLL_LONG_TASK_BUDGET_MS);
const searchScrollLongTaskBudget =
  Number.isFinite(configuredSearchScrollBudget) && configuredSearchScrollBudget > 0
    ? configuredSearchScrollBudget
    : 250;

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

    expect(await page.locator('[data-index]').count()).toBeLessThanOrEqual(14);
    expect(failures).toEqual([]);
  });

  test('bounds search rendering work during rapid desktop scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      window.__searchScrollLongTasks = [];
      new PerformanceObserver(list => {
        window.__searchScrollLongTasks.push(...list.getEntries().map(entry => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    });

    await page.goto('/search');
    const scroller = page.getByTestId('search-results-scroll');
    await expect(scroller).toBeVisible();
    await expect.poll(() => page.locator('[data-index]').count()).toBeGreaterThan(0);

    await scroller.hover();
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, -2400);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.__searchScrollLongTasks = [];
    });

    let maxMountedCells = 0;
    for (let index = 0; index < 5; index += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(100);
      maxMountedCells = Math.max(maxMountedCells, await page.locator('[data-index]').count());
    }
    await page.waitForTimeout(1000);

    const visibleCells = await scroller.evaluate(element => {
      const viewport = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('[data-index]')).filter(cell => {
        const bounds = cell.getBoundingClientRect();
        return bounds.bottom > viewport.top && bounds.top < viewport.bottom;
      }).length;
    });
    const maxLongTask = await page.evaluate(() => Math.max(0, ...window.__searchScrollLongTasks));

    expect(maxMountedCells).toBeLessThanOrEqual(20);
    expect(visibleCells).toBeGreaterThan(0);
    // React's development build and parallel E2E workers add substantial timing variance.
    // Keep the deterministic DOM-work bound strict and guard against the previous 393ms class.
    expect(maxLongTask).toBeLessThan(searchScrollLongTaskBudget);
  });

  test('restores conversations after using the mobile thread back button @smoke', async ({
    page,
  }) => {
    const failures = collectVirtualizerFailures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/messages');

    const conversation = page.getByRole('button', { name: /Aria & Kai/ }).first();
    await expect(conversation).toBeVisible({ timeout: 40_000 });
    await conversation.click();

    const backButton = page.getByRole('button', { name: 'Go Back' });
    await expect(backButton).toBeVisible();
    await backButton.click();

    await expect(conversation).toBeVisible();
    await expect(page.getByText('No conversations yet')).toHaveCount(0);
    await expect(page.getByText('No conversations found')).toHaveCount(0);
    expect(failures).toEqual([]);
  });
});

declare global {
  interface Window {
    __searchScrollLongTasks: number[];
  }
}
