import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';

interface NavigationLayoutSample {
  type: string;
  width: number;
  height: number;
  top: number;
  left: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface NavigationBox {
  width: number;
  height: number;
  top: number;
  left: number;
}

async function installNavigationLayoutSampler(page: Page) {
  await page.addInitScript(() => {
    window.__navigationLayoutSamples = [];

    const sample = () => {
      document.querySelectorAll<HTMLElement>('[data-navigation-type]').forEach(element => {
        const bounds = element.getBoundingClientRect();
        window.__navigationLayoutSamples.push({
          type: element.dataset.navigationType ?? '',
          width: bounds.width,
          height: bounds.height,
          top: bounds.top,
          left: bounds.left,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        });
      });
    };

    const start = () => {
      if (!document.documentElement) {
        requestAnimationFrame(start);
        return;
      }

      const startedAt = performance.now();
      let firstNavigationSeenAt: number | null = null;
      const sampleFrame = () => {
        const hasNavigation = document.querySelector('[data-navigation-type]') !== null;
        if (hasNavigation && firstNavigationSeenAt === null) {
          firstNavigationSeenAt = performance.now();
        }
        sample();
        const shouldKeepSampling =
          performance.now() - startedAt < 30_000 &&
          (firstNavigationSeenAt === null || performance.now() - firstNavigationSeenAt < 1_500);
        if (shouldKeepSampling) requestAnimationFrame(sampleFrame);
      };
      requestAnimationFrame(sampleFrame);
    };

    start();
  });
}

async function currentNavigationBoxes(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>('[data-navigation-type]')).map(element => {
        const bounds = element.getBoundingClientRect();
        return [
          element.dataset.navigationType,
          {
            width: bounds.width,
            height: bounds.height,
            top: bounds.top,
            left: bounds.left,
          },
        ];
      })
    )
  ) as Promise<Record<'primary' | 'secondary', NavigationBox>>;
}

async function expectNavigationBars(page: Page, viewportWidth: number, viewportHeight: number) {
  await expect
    .poll(async () => {
      const boxes = await currentNavigationBoxes(page);
      return (
        boxes.primary.width === viewportWidth &&
        boxes.primary.height < 100 &&
        boxes.primary.left === 0 &&
        Math.abs(boxes.primary.top + boxes.primary.height - viewportHeight) <= 1 &&
        boxes.secondary.width === viewportWidth &&
        boxes.secondary.height < 100 &&
        boxes.secondary.top === 0 &&
        boxes.secondary.left === 0
      );
    })
    .toBe(true);
}

test.describe('responsive navigation reload', () => {
  test('never exposes desktop sidebars during an authenticated mobile reload @smoke', async ({
    page,
    seed,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installNavigationLayoutSampler(page);
    await page.goto(`/group/${seed.groupId}`);

    await expect(page.locator('[data-navigation-type="primary"]')).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.locator('[data-navigation-type="secondary"]')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-navigation-type="primary"]')).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.locator('[data-navigation-type="secondary"]')).toBeVisible();
    await page.waitForTimeout(500);

    const samples = await page.evaluate(() => window.__navigationLayoutSamples);
    const sidebarSamples = samples.filter(
      sample =>
        sample.height >= sample.viewportHeight * 0.8 && sample.width <= sample.viewportWidth * 0.7
    );

    expect(samples.length).toBeGreaterThan(0);
    expect(sidebarSamples).toEqual([]);

    await expectNavigationBars(page, 390, 844);
  });

  test('switches from bars to sidebars exactly at the desktop breakpoint', async ({
    page,
    seed,
  }) => {
    await page.setViewportSize({ width: 767, height: 844 });
    await page.goto(`/group/${seed.groupId}`);
    await expect(page.locator('[data-navigation-type="primary"]')).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.locator('[data-navigation-type="secondary"]')).toBeVisible();

    await expectNavigationBars(page, 767, 844);

    await page.setViewportSize({ width: 768, height: 844 });
    await expect
      .poll(() => currentNavigationBoxes(page))
      .toMatchObject({
        primary: { width: 64, height: 844, top: 0, left: 0 },
        secondary: { width: 64, height: 844, top: 0, left: 704 },
      });
  });
});

declare global {
  interface Window {
    __navigationLayoutSamples: NavigationLayoutSample[];
  }
}
