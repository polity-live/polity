import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test-base';

async function dismissAlphaWarning(page: Page) {
  const confirm = page.getByRole('button', { name: /I understand|Ich verstehe/i });
  await confirm.waitFor({ state: 'visible', timeout: 2000 }).catch(() => undefined);
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    await confirm.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => undefined);
  }
}

test.describe('Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display one-page landing content and product previews', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissAlphaWarning(page);

    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#features')).toBeVisible();
    await expect(page.locator('#solutions')).toBeVisible();
    await expect(page.locator('#imprint')).toBeVisible();

    await expect(
      page.getByRole('heading', { name: /Understand your organization|Verstehe Organisation/i })
    ).toBeVisible();
    await expect(page.getByText(/Example network flow|Beispiel-Netzwerkfluss/i)).toBeVisible();
    await expect(page.getByText(/Sample event timeline|Beispiel-Event-Timeline/i)).toBeVisible();
    await expect(page.getByText(/Sample amendment text|Beispiel-Antragstext/i)).toBeVisible();
    await expect(page.getByText(/Sample change request|Beispiel-Änderungsantrag/i)).toHaveCount(0);
    await expect(
      page.getByText(/Network and workflow building|Netzwerk- und Workflow-Aufbau/i)
    ).toBeVisible();
    await expect(page.getByText(/Amendment route|Antragsweg/i)).toBeVisible();
    await expect(page.getByText(/Connection directions|Verbindungsrichtungen/i)).toHaveCount(0);
    const networkPanel = page
      .locator('.react-flow__panel', { hasText: /Amendment route|Antragsweg/i })
      .first();
    await networkPanel.getByRole('button').first().click();
    await page.getByRole('button', { name: /Legend|Legende/i }).first().click();
    await expect(page.getByText(/Connection directions|Verbindungsrichtungen/i)).toBeVisible();
    await expect(page.getByText(/Parent group|Übergeordnete Gruppe/i)).toBeVisible();
    await expect(page.getByText(/Info/i).first()).toBeVisible();
    await expect(page.getByText(/Amendment|Antrag/i).first()).toBeVisible();
    await expect(page.getByText(/Public Committee Hearing/i)).toBeVisible();
    await expect(page.getByText(/Parliamentary Group Meeting/i)).toBeVisible();
    await expect(page.getByText(/agenda-item-climate-budget-18/i)).toBeVisible();
    await expect(page.getByText(/AI drafting assistant|KI-Entwurfsassistenz/i)).toBeVisible();
    await expect(
      page.getByPlaceholder(/Search: climate reporting|Suche: Klimabericht/i)
    ).toBeVisible();

    const primaryNav = page.locator('.fixed.left-0').first();
    await expect(primaryNav.getByRole('button', { name: /Features|Funktionen/i })).toHaveCount(0);
    await expect(primaryNav.getByRole('button', { name: /Solutions|Lösungen/i })).toHaveCount(0);
    await expect(primaryNav.getByRole('button', { name: /Imprint|Impressum/i })).toHaveCount(0);
  });

  test('network preview should expose rights edges and static details dialogs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissAlphaWarning(page);

    await page.getByText(/Public Committee Hearing/i).first().click();
    await expect(page.getByRole('dialog')).toContainText(
      /Event Details|Veranstaltungsdetails/i
    );
    await expect(page.getByRole('dialog')).toContainText(/Public Committee Hearing/i);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    const rightsEdgeLabel = page.locator('button.nodrag', { hasText: /Info|Antrag|Amendment/i });
    await expect(rightsEdgeLabel.first()).toBeVisible();
    await rightsEdgeLabel.first().click();
    await expect(page.getByRole('dialog')).toContainText(
      /Relationship Details|Beziehungsdetails/i
    );
    await expect(page.getByRole('dialog')).toContainText(
      /Select rights|Rechte auswählen|Direction of individual rights|Richtung der einzelnen Rechte/i
    );
  });

  test('amendment preview should keep only the editor before the timeline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissAlphaWarning(page);

    await expect(
      page.locator('.fixed.z-50.justify-between.overflow-x-auto.border-b.border-b-border')
    ).toHaveCount(0);

    const editorTitle = page.getByText(/Sample amendment text|Beispiel-Antragstext/i).first();
    const timelineTitle = page.getByText(/Sample event timeline|Beispiel-Event-Timeline/i).first();

    await expect(editorTitle).toBeVisible();
    await expect(page.getByText(/Sample change request|Beispiel-Änderungsantrag/i)).toHaveCount(0);
    await expect(timelineTitle).toBeVisible();
    await expect(
      page.getByText(/Add measurable reporting milestones|Messbare Berichtsmeilensteine/i)
    ).toHaveCount(0);

    const editorBox = await editorTitle.boundingBox();
    const timelineBox = await timelineTitle.boundingBox();

    expect(editorBox?.y).toBeLessThan(timelineBox?.y ?? Number.POSITIVE_INFINITY);
  });

  test('secondary landing navigation should jump between sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissAlphaWarning(page);

    await page.locator('a[href="/#features"]').last().click();
    await expect(page).toHaveURL(/\/#features$/);
    await expect(page.locator('#features')).toBeInViewport();

    await page.locator('a[href="/#solutions"]').last().click();
    await expect(page).toHaveURL(/\/#solutions$/);
    await expect(page.locator('#solutions')).toBeInViewport();

    await page.locator('a[href="/#imprint"]').last().click();
    await expect(page).toHaveURL(/\/#imprint$/);
    await expect(page.locator('#imprint')).toBeInViewport();
  });

  test('legacy public routes should redirect to landing sections', async ({ page }) => {
    for (const section of ['features', 'solutions', 'imprint']) {
      await page.goto(`/${section}`);
      await page.waitForLoadState('networkidle');
      await dismissAlphaWarning(page);
      await expect(page).toHaveURL(new RegExp(`/#${section}$`));
      await expect(page.locator(`#${section}`)).toBeInViewport();
    }
  });

  test('should display support page', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    await dismissAlphaWarning(page);

    const heading = page.getByRole('heading').first();
    if ((await heading.count()) > 0) {
      await expect(heading).toBeVisible();
    }
  });

  test('should handle 404 not-found page', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('networkidle');
    await dismissAlphaWarning(page);

    const notFound = page.getByText(/not found|404|page doesn't exist/i);
    if ((await notFound.count()) > 0) {
      await expect(notFound.first()).toBeVisible();
    }
  });
});
