import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';

test.describe('final search cards', () => {
  test('keeps the final card and navigation while viewer actions load @pr', async ({
    page,
    seed,
  }) => {
    await page.addInitScript(() => {
      const requestIdle = window.requestIdleCallback.bind(window);
      const cancelIdle = window.cancelIdleCallback.bind(window);
      const callbacks = new Map<number, IdleRequestCallback>();
      let nextHandle = 0;
      window.requestIdleCallback = callback => {
        const handle = ++nextHandle;
        callbacks.set(handle, callback);
        return handle;
      };
      window.cancelIdleCallback = handle => {
        callbacks.delete(handle);
      };
      window.__releaseSearchIdle = () => {
        window.requestIdleCallback = requestIdle;
        window.cancelIdleCallback = cancelIdle;
        for (const callback of callbacks.values()) {
          callback({ didTimeout: false, timeRemaining: () => 50 });
        }
        callbacks.clear();
      };
    });
    await page.goto(`/search?types=group&view=list&q=${encodeURIComponent(seed.groupName)}`);
    const card = page.locator(`[data-search-document-id="group:${seed.groupId}"]`);
    await expect(card).toBeVisible();
    const title = card.getByRole('link', { name: seed.groupName, exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute('href', `/group/${seed.groupId}`);
    const membership = card.locator('[data-action-id="timeline.group.membership.menu.open"]');
    const subscription = card.locator('[data-action-id="timeline.group.subscription.toggle"]');
    await expect(membership).toBeDisabled();
    await expect(subscription).toBeDisabled();
    await expect(page.locator('[data-search-card-mode="preview"]')).toHaveCount(0);
    await title.evaluate(element => {
      element.setAttribute('data-lifecycle-token', 'original');
    });
    await title.focus();
    const initialBox = await card.boundingBox();
    await page.evaluate(() => window.__releaseSearchIdle());
    await expect(membership).toBeEnabled();
    await expect(subscription).toBeEnabled();
    await expect(title).toHaveAttribute('data-lifecycle-token', 'original');
    await expect(title).toBeFocused();
    expect(await card.boundingBox()).toEqual(initialBox);
    await expect(card.locator('[data-search-card-loading]')).toHaveCount(0);
    await title.click();
    await expect(page).toHaveURL(new RegExp(`/group/${seed.groupId}(?:\\?|$)`));
  });

  test('preserves native results through filters, scrolling and every search view @pr', async ({
    page,
    seed,
  }) => {
    await db()`update public."group" set latitude = 52.52, longitude = 13.405 where id = ${seed.groupId}::uuid`;
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/search?view=list&q=${encodeURIComponent(seed.groupName)}`);
    const groupLink = page.getByRole('link', { name: seed.groupName, exact: true });
    await expect(groupLink).toBeVisible();
    await page.getByRole('button', { name: 'Compact view', exact: true }).click();
    await expect(page.getByRole('link', { name: seed.groupName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Spatial view', exact: true }).click();
    await expect(page.getByRole('link', { name: seed.groupName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await expect(groupLink).toBeVisible();
    const query = page.getByRole('searchbox');
    await query.fill(seed.amendmentTitle);
    await expect(page.getByRole('link', { name: seed.amendmentTitle, exact: true })).toBeVisible();
    await expect(groupLink).toHaveCount(0);
    await query.fill('');
    const scroll = page.getByTestId('search-results-scroll');
    await expect(page.locator('[data-search-document-id]').first()).toBeVisible();
    await scroll.evaluate(element => {
      element.scrollTop = 500;
    });
    await expect(page.locator('[data-search-document-id]').first()).toBeVisible();
    await expect(page.locator('[data-search-card-mode="preview"]')).toHaveCount(0);
  });
});

declare global {
  interface Window {
    __releaseSearchIdle: () => void;
  }
}
