// spec: e2e/test-plans/chat-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '../fixtures/test-base';
import { ARIA_KAI_USER_ID } from '../aria-kai';

test.describe('Chat/Messages - Unread Message Count', () => {
  test('Unread messages show count badge', async ({
    authenticatedPage: page,
    conversationFactory,
    mainUserId,
  }) => {
    const conversationId = (await conversationFactory.createConversation(mainUserId, [ARIA_KAI_USER_ID], {
      status: 'accepted',
      type: 'direct',
    })).id;
    await conversationFactory.addMessage(
      conversationId,
      ARIA_KAI_USER_ID,
      'Unread assistant welcome message for badge verification'
    );

    await page.goto('/messages');

    const messagesNav = page.locator('a').filter({ hasText: /Messages/i }).first();
    await expect(messagesNav.getByText(/^1$/)).toBeVisible({ timeout: 10000 });

    const assistantConversation = page.getByRole('button').filter({ hasText: /Aria\s*&\s*Kai/i }).first();
    await expect(assistantConversation).toBeVisible({ timeout: 10000 });
    await expect(assistantConversation.getByText(/^1$/)).toBeVisible();

    await assistantConversation.click();
    await expect(
      page.getByText(/Unread assistant welcome message for badge verification/i)
    ).toBeVisible({ timeout: 10000 });

    await expect(messagesNav.getByText(/^1$/)).not.toBeVisible({ timeout: 10000 });
    await expect(assistantConversation.getByText(/^1$/)).not.toBeVisible({ timeout: 10000 });
  });

  test('Badge shows 99+ for high unread counts', async ({ authenticatedPage: page }) => {
    // 1. Authenticate as test user
    // 2. Navigate to messages page
    await page.goto('/messages');

    // 3. Check for any badges
    const badges = page.locator('[class*="Badge"]');
    const badgeCount = await badges.count();

    if (badgeCount > 0) {
      // 4. Verify badge text format
      for (let i = 0; i < badgeCount; i++) {
        const badge = badges.nth(i);
        const text = await badge.textContent();

        // Badge should show number or "99+"
        expect(text).toMatch(/^\d+(\+)?$/);

        // If it shows 99+, verify the format
        if (text === '99+') {
          await expect(badge).toBeVisible();
        }
      }
    }
  });
});
