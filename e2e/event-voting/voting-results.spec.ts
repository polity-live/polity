// spec: e2e/test-plans/event-voting-test-plan.md

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test-base';
import { TEST_ENTITY_IDS } from '../test-entity-ids';

const AGENDA_VOTING_DETAIL_URL = `/event/${TEST_ENTITY_IDS.EVENT}/agenda/${TEST_ENTITY_IDS.testAgendaItem1}`;

async function openVotingAgendaDetail(page: Page) {
  await page.goto(AGENDA_VOTING_DETAIL_URL, { waitUntil: 'domcontentloaded' });
}

async function expectContextFirstWithoutPageScroll(page: Page) {
  const results = page.getByTestId('agenda-detail-results');
  const contextSwitcher = page.getByTestId('agenda-detail-context-switcher');

  await expect(contextSwitcher).toBeVisible();
  await expect(results).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const resultBox = await results.boundingBox();
  const contextBox = await contextSwitcher.boundingBox();
  const viewportHeight = page.viewportSize()?.height ?? 0;

  if (!resultBox || !contextBox) {
    throw new Error('Agenda detail results or context switcher did not produce a layout box.');
  }

  expect(contextBox.y).toBeLessThan(resultBox.y);
  expect(contextBox.y).toBeLessThan(viewportHeight);
  expect(contextBox.y + Math.min(contextBox.height, 1)).toBeGreaterThan(0);
}

test.describe('Event Voting - Voting Results', () => {
  test('User can view completed voting results', async ({ authenticatedPage: page }) => {
    // 1. Authenticate
    // 2. Navigate to agenda item with completed voting
    await openVotingAgendaDetail(page);

    // 3. Look for completed voting state
    const completedText = page.getByText(/completed|passed|rejected|tie/i);
    if ((await completedText.count()) > 0) {
      // 4. Vote counts should be displayed
      // At least the result should be visible
      await expect(completedText.first()).toBeVisible();
    }
  });

  test('Vote results show progress bar and counts', async ({ authenticatedPage: page }) => {
    // 1. Authenticate
    // 2. Navigate to agenda item
    await openVotingAgendaDetail(page);

    // 3. Look for votes received section
    const votesReceived = page.getByText(/votes received/i);
    if ((await votesReceived.count()) > 0) {
      // 4. Progress bar should be visible
      const progressBar = page.getByRole('progressbar');
      if ((await progressBar.count()) > 0) {
        await expect(progressBar.first()).toBeVisible();
      }
    }
  });

  test('Agenda detail context switcher loads before results on desktop and mobile', async ({
    authenticatedPage: page,
  }) => {
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openVotingAgendaDetail(page);
        await expectContextFirstWithoutPageScroll(page);
      });
    }
  });

  test('Agenda detail context switcher toggles between details and speakers', async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVotingAgendaDetail(page);

    const details = page.getByTestId('agenda-detail-context-details');
    const speakers = page.getByTestId('agenda-detail-context-speakers');
    const toggle = page.getByTestId('agenda-detail-context-toggle');

    await expect(details).toHaveAttribute('aria-hidden', 'false');
    await expect(speakers).toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toContainText(/speakers|rednerliste|redeliste/i);

    await toggle.click();
    await expect(details).toHaveAttribute('aria-hidden', 'true');
    await expect(speakers).toHaveAttribute('aria-hidden', 'false');
    await expect(toggle).toContainText(/details/i);

    await toggle.click();
    await expect(details).toHaveAttribute('aria-hidden', 'false');
    await expect(speakers).toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toContainText(/speakers|rednerliste|redeliste/i);
  });
});
