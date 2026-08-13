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
    tags: '@nightly @mobile',
    language: 'de',
    viewport: { width: 393, height: 852 },
  },
  {
    name: 'desktop in en',
    tags: '@nightly',
    language: 'en',
    viewport: { width: 1280, height: 720 },
  },
] as const;

test.describe.serial('localized live tutorial', () => {
  for (const scenario of FULL_TUTORIAL_SCENARIOS) {
    test(`completes all live tutorial checkpoints on ${scenario.name} ${scenario.tags}`, async ({
      page,
      e2eUser,
      tutorialFlowPage,
    }) => {
      test.setTimeout(15 * 60_000);

      await page.setViewportSize(scenario.viewport);
      expect(page.viewportSize()).toEqual(scenario.viewport);

      const originalCompletion = await tutorialCompletionFor(e2eUser.id);

      try {
        await cleanupTutorialRuns(e2eUser.id);
        await tutorialFlowPage.installExternalServiceStubs();
        await tutorialFlowPage.useLanguage(e2eUser.id, scenario.language);
        await page.goto('/onboarding?restart=true');
        await page.waitForURL(/\/home$/, { timeout: 120_000 });
        await tutorialFlowPage.waitForTutorialRestartRequests();
        expect(tutorialFlowPage.tutorialRestartRequestCount()).toBe(1);
        await page.reload();
        tutorialFlowPage.resetBrowserErrors();
        await expect(page.locator('html')).toHaveAttribute('lang', scenario.language);

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
