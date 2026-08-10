import { expect, test as publicTest, type Page } from '@playwright/test';

import { test as authenticatedTest } from './fixtures/test';
import { waitForAppReady } from './fixtures/readiness';

publicTest.describe('deterministic public visual baselines', () => {
  publicTest.use({
    storageState: { cookies: [], origins: [] },
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    viewport: { width: 1440, height: 1000 },
  });

  for (const [name, route, heading] of [
    ['public-home', '/', undefined],
    ['sign-in', '/auth/sign-in', /Sign in to Polity|Bei Polity anmelden/],
    ['docs-home', '/docs', undefined],
  ] as const) {
    publicTest(`${name} matches its reviewed layout @nightly @visual`, async ({ page }) => {
      await page.goto(route);
      await expect(
        heading ? page.getByRole('heading', { name: heading }) : page.locator('h1')
      ).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
      });
    });
  }

  publicTest(
    'visual.public.not-found matches the deterministic error layout @nightly @visual',
    async ({ page }) => {
      await page.goto('/visual-regression/missing-state');
      await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
      await expect(page).toHaveScreenshot('public-not-found.png', {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
      });
    }
  );
});

async function openUserMenu(page: Page) {
  const trigger = page
    .locator('[data-action-id="navigation.user-menu.open"]')
    .and(page.getByRole('button', { name: /\S+/ }));
  await expect(trigger).toHaveCount(1);
  await trigger.click();

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

authenticatedTest.describe('deterministic authenticated visual baselines', () => {
  authenticatedTest.use({
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    viewport: { width: 1440, height: 1000 },
  });

  authenticatedTest(
    'visual.auth.navigation-user-menu-open shows authenticated navigation @nightly @visual',
    async ({ e2eRun, page }) => {
      await page.goto('/home');
      await waitForAppReady(page);

      const menu = await openUserMenu(page);
      const actorIdentity = menu.getByText(e2eRun.actor().email, { exact: true });
      await expect(actorIdentity).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Profile', exact: true })).toBeVisible();
      await expect(
        menu.locator('[data-action-id="navigation.user-menu.docs-dialog.open"]')
      ).toBeVisible();
      await expect(menu).toHaveScreenshot('authenticated-user-menu-open.png', {
        animations: 'disabled',
        caret: 'hide',
        mask: [actorIdentity],
        maskColor: '#d1d5db',
        maxDiffPixelRatio: 0.005,
      });
    }
  );

  authenticatedTest(
    'visual.auth.documentation-dialog-open shows a real dialog @nightly @visual',
    async ({ page, seed }) => {
      await page.goto(`/group/${seed.groupId}`);
      await waitForAppReady(page);

      const menu = await openUserMenu(page);
      await menu.locator('[data-action-id="navigation.user-menu.docs-dialog.open"]').click();

      const dialog = page.getByRole('dialog', {
        name: 'Documentation & Feedback',
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveScreenshot('authenticated-documentation-dialog-open.png', {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
      });
    }
  );

  authenticatedTest(
    'visual.auth.create-group-empty-one-page shows the create form @nightly @visual',
    async ({ createFlowPage }) => {
      await createFlowPage.goto('/create/group', 'one_page');

      const createForm = createFlowPage.page.locator(
        '[data-create-flow="group"][data-create-layout="one_page"]'
      );
      await expect(createForm).toBeVisible();
      await expect(createForm).toHaveScreenshot('create-group-empty-one-page.png', {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
      });
    }
  );
});
