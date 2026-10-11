import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';

const RUNS = 3;
const CLICK_PROCESSING_BUDGET_MS = 50;
const DOWNSTREAM_TASK_BUDGET_MS = 75;
const SINGLE_MEASUREMENT_BUDGET_MS = 100;

interface TransitionMeasurement {
  clickProcessing: number;
  maxLongTask: number;
  longTasks: { offset: number; duration: number }[];
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function waitForPaint(page: Page, frames = 4) {
  await page.evaluate(
    frameCount =>
      new Promise<void>(resolve => {
        const next = (remaining: number) =>
          requestAnimationFrame(() => (remaining <= 1 ? resolve() : next(remaining - 1)));
        next(frameCount);
      }),
    frames
  );
}

test.describe('messages to search transition', () => {
  test('stays responsive while rendering final search cards @nightly @performance', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      window.__messagesSearchEvents = [];
      window.__messagesSearchLongTasks = [];
      new PerformanceObserver(list => {
        window.__messagesSearchEvents.push(
          ...list.getEntries().map(entry => {
            const event = entry as PerformanceEventTiming;
            return {
              name: event.name,
              startTime: event.startTime,
              duration: event.duration,
              processingStart: event.processingStart,
              processingEnd: event.processingEnd,
              interactionId: event.interactionId,
            };
          })
        );
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      new PerformanceObserver(list => {
        window.__messagesSearchLongTasks.push(
          ...list.getEntries().map(entry => ({
            startTime: entry.startTime,
            duration: entry.duration,
          }))
        );
      }).observe({ type: 'longtask', buffered: true });
    });

    // Warm the route once so development-only module compilation is not part of the click budget.
    await page.goto('/search');
    await expect(page.getByTestId('search-results-scroll')).toBeVisible({
      timeout: 20_000,
    });
    const initialCard = page.locator('[data-search-document-id][data-index="0"]');
    await expect(initialCard).toBeVisible();
    await expect(initialCard.locator('[data-timeline-card-header]')).toBeVisible();
    await expect(page.locator('[data-search-card-loading]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/\/messages(?:\?|$)/);

    const measurements: TransitionMeasurement[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      await expect(page).toHaveURL(/\/messages(?:\?|$)/);
      await waitForPaint(page);
      await page.evaluate(() => {
        window.__messagesSearchEvents = [];
        window.__messagesSearchLongTasks = [];
        window.__messagesSearchClickStart = performance.now();
      });

      await page.getByRole('link', { name: 'Search' }).click();
      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect
        .poll(() => page.locator('[data-search-document-id]').count(), {
          timeout: 10_000,
        })
        .toBeGreaterThan(0);

      await expect(initialCard).toHaveCount(1);
      await expect(initialCard.locator('[data-timeline-card-header]')).toBeVisible();
      await expect
        .poll(() => initialCard.getByRole('link').filter({ visible: true }).count())
        .toBeGreaterThan(0);

      await expect(page.locator('[data-search-card-mode="preview"]')).toHaveCount(0);
      await expect(page.locator('[data-search-card-loading]')).toHaveCount(0);
      await expect(
        page.locator('[data-search-document-id] [data-action-id$=".subscription.toggle"]:disabled')
      ).toHaveCount(0);
      await expect(page.locator('[data-search-document-id] [data-loading="true"]')).toHaveCount(0);
      await waitForPaint(page);

      measurements.push(
        await page.evaluate(() => {
          const clickStart = window.__messagesSearchClickStart;
          const clickEvent = window.__messagesSearchEvents
            .filter(event => event.name === 'click' && event.startTime >= clickStart)
            .sort((left, right) => right.duration - left.duration)[0];
          const relevantLongTasks = window.__messagesSearchLongTasks.filter(
            task => task.startTime >= clickStart
          );
          return {
            clickProcessing: clickEvent ? clickEvent.processingEnd - clickEvent.processingStart : 0,
            maxLongTask: Math.max(0, ...relevantLongTasks.map(task => task.duration)),
            longTasks: relevantLongTasks.map(task => ({
              offset: task.startTime - clickStart,
              duration: task.duration,
            })),
          };
        })
      );

      if (run < RUNS - 1) {
        await page.getByRole('link', { name: 'Messages' }).click();
        await expect(page).toHaveURL(/\/messages(?:\?|$)/);
      }
    }

    const clickProcessing = measurements.map(measurement => measurement.clickProcessing);
    const downstreamTasks = measurements.map(measurement => measurement.maxLongTask);
    console.info('messages-search measurements', JSON.stringify(measurements));

    expect(median(clickProcessing)).toBeLessThan(CLICK_PROCESSING_BUDGET_MS);
    expect(median(downstreamTasks)).toBeLessThan(DOWNSTREAM_TASK_BUDGET_MS);
    expect(Math.max(...clickProcessing, ...downstreamTasks)).toBeLessThan(
      SINGLE_MEASUREMENT_BUDGET_MS
    );
  });
});

declare global {
  interface Window {
    __messagesSearchClickStart: number;
    __messagesSearchEvents: {
      name: string;
      startTime: number;
      duration: number;
      processingStart: number;
      processingEnd: number;
      interactionId: number;
    }[];
    __messagesSearchLongTasks: { startTime: number; duration: number }[];
  }
}
