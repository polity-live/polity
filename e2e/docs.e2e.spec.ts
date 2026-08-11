import { expect, test } from '@playwright/test';

const searchLabel = /Search documentation|Dokumentation durchsuchen/;
const openNavigationLabel = /Open docs navigation|Docs-Navigation öffnen/;

test.describe('public documentation', () => {
  test('searches sections by keyboard and opens their anchors @nightly', async ({ page }) => {
    await page.goto('/docs');

    await expect(page.getByText('Polity Docs')).toBeVisible();
    await page.keyboard.press('/');

    const search = page.getByRole('combobox', { name: searchLabel });
    await expect(search).toBeFocused();
    await search.fill('ballot');

    const result = page
      .getByRole('option', { name: /Votes|Abstimmungen/ })
      .filter({ visible: true });
    await expect(result).toHaveCount(1);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/docs\/guides\/votes#[a-z-]+$/);
    const sectionId = new URL(page.url()).hash.slice(1);
    await expect(page.locator(`section#${sectionId}`)).toBeVisible();
  });

  test('renders the article navigation and redirects legacy links @nightly', async ({ page }) => {
    await page.goto('/docs/groups');

    await expect(page).toHaveURL(/\/docs\/guides\/groups$/);
    await expect(page.getByRole('heading', { level: 1, name: /Groups|Gruppen/ })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: /On this page|Auf dieser Seite/ })
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: /On this page|Auf dieser Seite/ })
        .getByRole('link', { name: /Typical workflow|Typischer Ablauf/ })
    ).toBeVisible();
  });

  test('uses a drawer and collapsible page overview on mobile @nightly @mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/docs/guides/groups');

    await expect(page.getByRole('button', { name: openNavigationLabel })).toBeVisible();
    await expect(page.getByText(/Show page overview|Seitenübersicht anzeigen/)).toBeVisible();

    await page.getByRole('button', { name: openNavigationLabel }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: /Documentation|Dokumentation/ })
    ).toBeVisible();
  });
});
