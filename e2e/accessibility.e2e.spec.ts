import AxeBuilder from '@axe-core/playwright';
import { expect, test as publicTest } from '@playwright/test';

import { test as authenticatedTest } from './fixtures/test';
import { waitForAppReady } from './fixtures/readiness';

async function expectNoSeriousAccessibilityViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations
    .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    .map(violation => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map(node => ({
        target: node.target.join(' '),
        html: node.html,
        failure: node.failureSummary,
      })),
    }));
  expect(blocking).toEqual([]);
}

publicTest.describe('public accessibility', () => {
  publicTest.use({
    contextOptions: { reducedMotion: 'reduce' },
    storageState: { cookies: [], origins: [] },
  });

  for (const [route, heading] of [
    ['/', undefined],
    ['/auth/sign-in', /Sign in to Polity|Bei Polity anmelden/],
    ['/docs', undefined],
  ] as const) {
    publicTest(
      `has no serious WCAG A/AA violations on ${route} @nightly @a11y`,
      async ({ page }) => {
        await page.goto(route);
        await expect(
          heading ? page.getByRole('heading', { name: heading }) : page.locator('h1')
        ).toBeVisible();
        await expectNoSeriousAccessibilityViolations(page);
      }
    );
  }

  publicTest(
    'supports keyboard focus order in the sign-in form @nightly @a11y',
    async ({ page }) => {
      await page.goto('/auth/sign-in');
      await expect(
        page.getByRole('heading', { name: /Sign in to Polity|Bei Polity anmelden/ })
      ).toBeVisible();

      const email = page.locator('#email');
      const password = page.locator('#password');
      const passwordVisibility = password.locator('..').getByRole('button');
      const submit = page
        .locator('form[data-action-id="auth.sign-in.submit.password"]')
        .locator('button[type="submit"]');

      await email.focus();
      await expect(email).toBeFocused();
      await page.keyboard.type('a11y-user@example.com');
      await password.focus();
      await expect(password).toBeFocused();
      await page.keyboard.type('AccessiblePassword!1');
      await page.keyboard.press('Tab');
      await expect(passwordVisibility).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(submit).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page);
    }
  );
});

authenticatedTest(
  'has no serious violations in the authenticated shell @nightly @a11y',
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/home');
    await waitForAppReady(page);
    await expectNoSeriousAccessibilityViolations(page);
  }
);

authenticatedTest(
  'opens and closes the authenticated user menu by keyboard @nightly @a11y',
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/home');
    await waitForAppReady(page);

    const trigger = page
      .locator('[data-action-id="navigation.user-menu.open"]')
      .and(page.getByRole('button', { name: /\S+/ }));
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAccessibleName(/.+/);
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator(':focus')).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  }
);

authenticatedTest(
  'keeps focus inside the invite-members dialog and restores its trigger @nightly @a11y',
  async ({ page, seed }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/group/${seed.groupId}/memberships`);
    await waitForAppReady(page);

    const trigger = page.locator('[data-action-id="groups.invitations.open.members-dialog"]');
    await expect(trigger).toHaveAccessibleName(/.+/);
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/.+/);
    await expect(dialog.locator(':focus')).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
);

authenticatedTest(
  'supports focused keyboard input in a fixture-backed create form @nightly @a11y',
  async ({ createFlowPage, e2eRun, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createFlowPage.goto('/create/group', 'one_page');
    await createFlowPage.expectLoaded('group');

    const name = createFlowPage.form.field('name').getByRole('textbox');
    await expect(name).toHaveAccessibleName(/.+/);
    await name.focus();
    await expect(name).toBeFocused();
    await page.keyboard.type(`${e2eRun.prefix} Accessible Group`);
    await expect(name).toHaveValue(`${e2eRun.prefix} Accessible Group`);
    await page.keyboard.press('Tab');
    await expect(name).not.toBeFocused();
    await expectNoSeriousAccessibilityViolations(page);
  }
);
