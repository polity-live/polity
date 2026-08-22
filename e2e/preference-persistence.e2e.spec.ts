import { ALPHA_WARNING_SESSION_KEY } from '@/features/shared/constants';
import type { BrowserContext } from '@playwright/test';

import { expect, test } from './fixtures/test';
import { signInThroughUi } from './fixtures/auth-flow-page';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';

async function closeContextWithin(context: BrowserContext | undefined, timeoutMs = 5_000) {
  if (!context) return;

  await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    void context.close().then(finish, finish);
  });
}

test('keeps language and theme through a fresh authenticated session @pr @mobile @agent1-promotion', async ({
  browser,
  page,
  e2eUser,
}) => {
  test.setTimeout(180_000);
  const sql = db();
  const [original] = await sql<{ language: string; theme: string }[]>`
    select language, theme
    from public.user_preference
    where user_id = ${e2eUser.id}::uuid
  `;
  const settings = `/user/${e2eUser.id}/settings?tab=preferences`;
  let resumedContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  try {
    await page.goto(settings);
    await waitForAppReady(page);
    await expect(
      page.locator('[data-action-id="users.appearance.theme.select"][aria-pressed="true"]')
    ).toBeVisible();
    const languageTrigger = page.locator('[data-action-id="navigation.language.popover.open"]');
    await languageTrigger.evaluate(element =>
      element.scrollIntoView({ block: 'center', inline: 'nearest' })
    );
    await expect(languageTrigger).toBeInViewport();
    await languageTrigger.click();
    const languagePopover = page.locator('[data-slot="popover-content"]').filter({ visible: true });
    await expect(languagePopover).toBeVisible();
    const germanOption = languagePopover.locator(
      '[data-action-id="navigation.language.popover.german"]'
    );
    await expect(germanOption).toBeVisible();
    await germanOption.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await page.locator('[data-action-id="navigation.theme.dark.select"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await expect
      .poll(async () => {
        const [row] = await sql<{ language: string; theme: string }[]>`
          select language, theme
          from public.user_preference
          where user_id = ${e2eUser.id}::uuid
        `;
        return row;
      })
      .toEqual({ language: 'de', theme: 'dark' });

    resumedContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    await resumedContext.addInitScript(alphaWarningSessionKey => {
      window.sessionStorage.setItem(alphaWarningSessionKey, 'true');
    }, ALPHA_WARNING_SESSION_KEY);
    await resumedContext.route('**/api/currency/currencies', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ currencies: ['EUR', 'GBP', 'JPY', 'USD'], source: 'test' }),
      })
    );
    await resumedContext.route('**/api/currency/rates', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rates: [] }),
      })
    );
    const resumedPage = await resumedContext.newPage();
    await resumedPage.goto('/auth/sign-in');
    await signInThroughUi(resumedPage, e2eUser);
    await resumedPage.goto(settings);
    await waitForAppReady(resumedPage);

    await expect(resumedPage.locator('html')).toHaveClass(/dark/);
    await expect(
      resumedPage.locator('[data-action-id="navigation.language.popover.open"]')
    ).toContainText('🇩🇪');
  } finally {
    await closeContextWithin(resumedContext);
    if (original) {
      await sql`
        update public.user_preference
        set language = ${original.language}, theme = ${original.theme}, updated_at = now()
        where user_id = ${e2eUser.id}::uuid
      `;
    }
  }
});
