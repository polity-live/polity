import { expect, test } from '@playwright/test';

const deferredPreviewSelector = '[data-slot="deferred-landing-preview"]';
const heavyPreviewResource =
  /(?:(?:node_modules|\/assets\/).*(?:three|leaflet|plate|xyflow)|NetworkFlowBase|AssistantMessageInput|CivicTimelineMap|Landing(?:Street|Social|Network|Agenda|Vote|Activity|Search|Official|Amendment))/i;

test.describe('public landing startup performance', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('defers interactive previews until scrolling without startup layout shifts @nightly @performance', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(10_000);
      window.__publicLandingPerformance = { cls: 0, longTasks: [] };

      new PerformanceObserver(list => {
        window.__publicLandingPerformance.longTasks.push(
          ...list.getEntries().map(entry => entry.duration)
        );
      }).observe({ type: 'longtask', buffered: true });

      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as LayoutShift[]) {
          if (!entry.hadRecentInput) window.__publicLandingPerformance.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    const previews = page.locator(deferredPreviewSelector);
    await expect(previews).toHaveCount(9);
    await expect
      .poll(() =>
        previews.evaluateAll(elements =>
          elements.map(element => element.getAttribute('data-preview-state'))
        )
      )
      .toEqual(Array(9).fill('idle'));

    expect(await page.locator('*').count()).toBeLessThan(1_000);
    expect(
      await page.evaluate(
        regexSource =>
          performance
            .getEntriesByType('resource')
            .some(entry => new RegExp(regexSource, 'i').test(entry.name)),
        heavyPreviewResource.source
      )
    ).toBe(false);

    const startupMaxLongTask = await page.evaluate(() =>
      Math.max(0, ...window.__publicLandingPerformance.longTasks)
    );
    expect(startupMaxLongTask).toBeLessThan(500);

    for (const preview of await previews.all()) {
      await preview.scrollIntoViewIfNeeded();
      await expect(preview).toHaveAttribute('data-preview-state', 'ready', {
        timeout: 20_000,
      });
      await expect(preview.getByRole('alert')).toHaveCount(0);
    }

    expect(await page.evaluate(() => window.__publicLandingPerformance.cls)).toBeLessThan(0.05);
  });
});

declare global {
  interface Window {
    __publicLandingPerformance: {
      cls: number;
      longTasks: number[];
    };
  }

  interface LayoutShift extends PerformanceEntry {
    hadRecentInput: boolean;
    value: number;
  }
}
