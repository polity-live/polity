import { expect, test } from './fixtures/test';
import {
  cleanupCommunicationFlow,
  installCommunicationBoundaryFakes,
  seedMessageFlow,
} from './fixtures/domains/communications';

test('sends, searches, and reopens a persisted cross-actor message after reload @pr @acceptance', async ({
  e2eRun,
  page,
  seed,
}) => {
  await installCommunicationBoundaryFakes(page);
  const fixture = await seedMessageFlow(e2eRun.prefix, seed.extraUserId, seed.userId);
  try {
    await page.goto('/messages');
    const search = page.locator('[data-action-id="messages.conversation.search.change"]');
    await expect(search).toBeVisible();
    await search.fill(fixture.content);
    const matchingConversation = page.locator('[data-action-id="messages.conversation.select"]');
    await expect(matchingConversation).toHaveCount(1);
    await matchingConversation.click();
    const persistedMessage = page.getByText(fixture.content, { exact: true });
    await expect(persistedMessage).toBeVisible();

    await page.reload();
    await expect(search).toBeVisible();
    await search.fill(fixture.content);
    await expect(matchingConversation).toHaveCount(1);
    await matchingConversation.click();
    await expect(persistedMessage).toBeVisible();
  } finally {
    await cleanupCommunicationFlow({ conversationId: fixture.conversationId });
  }
});
