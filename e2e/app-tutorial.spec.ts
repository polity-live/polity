import { test, expect } from './fixtures/test';
import {
  cleanupTutorialRuns,
  restoreTutorialCompletion,
  tutorialCompletionFor,
  tutorialRunIdFor,
  tutorialSandboxRowCount,
} from './fixtures/tutorial-flow-page';

const FULL_TUTORIAL_SCENARIOS = [
  {
    name: 'mobile in de',
    language: 'de',
    viewport: { width: 393, height: 852 },
  },
  {
    name: 'desktop in en',
    language: 'en',
    viewport: null,
  },
] as const;

test.describe.serial('localized live tutorial', () => {
  for (const scenario of FULL_TUTORIAL_SCENARIOS) {
    test(`completes all live tutorial checkpoints on ${scenario.name}`, async ({
      page,
      e2eUser,
      tutorialFlowPage,
    }) => {
      test.setTimeout(15 * 60_000);

      if (scenario.viewport) {
        await page.setViewportSize(scenario.viewport);
      }

      const originalCompletion = await tutorialCompletionFor(e2eUser.id);

      try {
        await cleanupTutorialRuns(e2eUser.id);
        await tutorialFlowPage.installExternalServiceStubs();
        await tutorialFlowPage.useLanguage(scenario.language);
        await page.goto('/onboarding?restart=true');
        await page.waitForURL(/\/home$/, { timeout: 120_000 });
        await tutorialFlowPage.waitForTutorialRestartRequests();
        expect(tutorialFlowPage.tutorialRestartRequestCount()).toBe(1);
        await page.reload();
        tutorialFlowPage.resetBrowserErrors();

        await expect.poll(() => tutorialRunIdFor(e2eUser.id), { timeout: 120_000 }).not.toBeNull();
        const createdRunId = await tutorialRunIdFor(e2eUser.id);
        if (!createdRunId) throw new Error('Tutorial run was not created.');

        await tutorialFlowPage.completeAllCheckpoints();

        await expect(page).toHaveURL(/\/home$/);
        await expect(page.locator('[data-tutorial-checkpoint]')).toHaveCount(0);
        await expect.poll(() => tutorialCompletionFor(e2eUser.id)).not.toBeNull();
        await expect.poll(() => tutorialRunIdFor(e2eUser.id)).toBeNull();
        await expect.poll(() => tutorialSandboxRowCount(createdRunId)).toBe(0);
      } finally {
        await cleanupTutorialRuns(e2eUser.id);
        await restoreTutorialCompletion(e2eUser.id, originalCompletion);
      }
    });
  }
});

test('keeps mobile Search reachable after scrolling the primary bar', async ({
  page,
  e2eUser,
  tutorialFlowPage,
}) => {
  test.setTimeout(3 * 60_000);
  await page.setViewportSize({ width: 393, height: 852 });

  const originalCompletion = await tutorialCompletionFor(e2eUser.id);

  try {
    await cleanupTutorialRuns(e2eUser.id);
    await tutorialFlowPage.installExternalServiceStubs();
    await tutorialFlowPage.useLanguage('de');
    await page.goto('/onboarding?restart=true');
    await page.waitForURL(/\/home$/, { timeout: 120_000 });
    await tutorialFlowPage.waitForTutorialRestartRequests();
    await expect.poll(() => tutorialRunIdFor(e2eUser.id), { timeout: 120_000 }).not.toBeNull();

    await expect(page.locator('[data-tutorial-checkpoint="primary-navigation"]')).toHaveCount(1, {
      timeout: 120_000,
    });
    const primaryScroller = page
      .locator('[data-tutorial-horizontal-scroller="primary-navigation"]:visible')
      .last();
    await expect(primaryScroller).toBeVisible();
    const availableScrollRange = await primaryScroller.evaluate(element => {
      const range = Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollLeft = range;
      element.dispatchEvent(new Event('scroll'));
      return range;
    });
    expect(availableScrollRange).toBeGreaterThan(0);

    await expect(page.locator('[data-tutorial-checkpoint="open-create"]')).toHaveCount(1, {
      timeout: 120_000,
    });
    await page.locator('[data-tutorial-anchor="primary-create"]:visible').last().click();

    await page.waitForURL(/\/create$/, { timeout: 120_000 });
    await expect(page.locator('[data-tutorial-checkpoint="open-search"]')).toHaveCount(1, {
      timeout: 120_000,
    });

    const search = page.locator('[data-tutorial-anchor="primary-search"]:visible').last();
    await expect(search).toBeInViewport();
    expect(
      await search.evaluate(element => {
        const scroller = element.closest<HTMLElement>(
          '[data-tutorial-horizontal-scroller="primary-navigation"]'
        );
        if (!scroller) return false;
        const targetRect = element.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        return (
          targetRect.left >= scrollerRect.left &&
          targetRect.right <= scrollerRect.right &&
          targetRect.left >= 0 &&
          targetRect.right <= window.innerWidth
        );
      })
    ).toBe(true);

    await search.click({ trial: true });
  } finally {
    await cleanupTutorialRuns(e2eUser.id);
    await restoreTutorialCompletion(e2eUser.id, originalCompletion);
  }
});
