import { expect, type Locator } from '@playwright/test';

/** Observe the existing exact locator after the action, before its brief success exits. */
export async function observeVoteSuccess(locator: Locator): Promise<void> {
  await expect.poll(() => locator.isVisible(), { timeout: 5_000, intervals: [16] }).toBe(true);
}
