import { expect, test as publicTest, type Page } from '@playwright/test';

import { test } from './fixtures/test';
import { waitForAppReady } from './fixtures/readiness';

const emptyAiCatalog = {
  credentials: [],
  models: [],
};

async function mockAvailableAiCatalog(page: Page) {
  await page.route('**/api/ai/catalog', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyAiCatalog),
    });
  });
}

function aiCatalogErrorToast(page: Page) {
  return page
    .locator('[data-sonner-toast][data-type="error"]')
    .filter({ hasText: 'Failed to load AI settings.' });
}

function aiCredentialToast(page: Page, type: 'error' | 'success', text: string) {
  return page.locator(`[data-sonner-toast][data-type="${type}"]`).filter({ hasText: text });
}

publicTest.describe('PWA offline resilience', () => {
  publicTest.use({ storageState: { cookies: [], origins: [] } });

  publicTest(
    'serves a previously warmed route while offline @nightly @resilience',
    async ({ context, page }) => {
      await page.goto('/auth/sign-in');
      await expect(
        page.getByRole('heading', {
          name: /Sign in to Polity|Bei Polity anmelden/,
        })
      ).toBeVisible();
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();

      await context.setOffline(true);
      await page.goto('/auth/sign-in');
      await expect(
        page.getByRole('heading', {
          name: /Sign in to Polity|Bei Polity anmelden/,
        })
      ).toBeVisible();
      await context.setOffline(false);
    }
  );
});

test.describe('authenticated recovery boundaries', () => {
  // API mocks must reach Playwright's routing layer. The dedicated PWA test above remains
  // outside this describe so its service worker stays enabled for the offline-cache contract.
  test.use({ serviceWorkers: 'block' });

  test('reports and recovers a Zero connection loss @nightly @resilience', async ({
    context,
    page,
  }) => {
    await page.goto('/home');
    await waitForAppReady(page);
    const marker = page.getByTestId('app-readiness');

    await context.setOffline(true);
    await expect
      .poll(() => marker.getAttribute('data-zero-connection'), {
        timeout: 30_000,
      })
      .toMatch(/connecting|disconnected/);

    await context.setOffline(false);
    await expect(marker).toHaveAttribute('data-zero-connection', 'connected', {
      timeout: 60_000,
    });
  });

  test('resilience.api.ai-catalog-recovery shows the error and recovers after reload @nightly @resilience', async ({
    e2eRun,
    page,
  }) => {
    let catalogAvailable = false;
    let failedRequests = 0;
    await page.route('**/api/ai/catalog', async route => {
      if (!catalogAvailable) {
        failedRequests += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'catalog_temporarily_unavailable' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyAiCatalog),
      });
    });

    const failedCatalogResponse = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === '/api/ai/catalog' && response.status() === 503
    );
    await page.goto(`/user/${e2eRun.actorId}/settings?tab=ai`);
    await failedCatalogResponse;
    await waitForAppReady(page);
    expect(failedRequests).toBeGreaterThan(0);
    await expect(aiCatalogErrorToast(page)).toBeVisible();

    catalogAvailable = true;
    const recoveredResponse = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === '/api/ai/catalog' && response.status() === 200
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await recoveredResponse;
    await waitForAppReady(page);

    await expect(page.locator('[data-tutorial-anchor="settings-ai-tools"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-anchor="settings-ai-skills"]')).toBeVisible();
    await expect(aiCatalogErrorToast(page)).toHaveCount(0);
  });

  test('resilience.auth.group-offline-online-reconnect preserves the core view @nightly @resilience', async ({
    context,
    e2eRun,
    page,
    seed,
  }) => {
    expect(seed.userId).toBe(e2eRun.actorId);
    await page.goto(`/group/${seed.groupId}`);
    await waitForAppReady(page);

    const marker = page.getByTestId('app-readiness');
    const groupHeading = page.getByRole('heading', { name: seed.groupName, exact: true });
    await expect(groupHeading).toBeVisible();

    await context.setOffline(true);
    await expect
      .poll(() => marker.getAttribute('data-zero-connection'), { timeout: 30_000 })
      .toMatch(/connecting|disconnected/);
    await expect(groupHeading).toBeVisible();

    await context.setOffline(false);
    await expect(marker).toHaveAttribute('data-zero-connection', 'connected', {
      timeout: 60_000,
    });
    await expect(groupHeading).toBeVisible();
  });

  test('resilience.mutation.ai-credential-failure never reports a false success @nightly @resilience', async ({
    e2eRun,
    page,
  }) => {
    await mockAvailableAiCatalog(page);
    let failedRequest: { apiKey?: string; provider?: string } | undefined;
    await page.route('**/api/ai/credentials', async route => {
      failedRequest = route.request().postDataJSON() as {
        apiKey?: string;
        provider?: string;
      };
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'credential_store_unavailable' }),
      });
    });

    await page.goto(`/user/${e2eRun.actorId}/settings?tab=ai`);
    await waitForAppReady(page);
    await expect(page.locator('[data-tutorial-anchor="settings-byoc"]')).toBeVisible();

    const providerCard = page.locator(
      '[data-slot="card"]:has(> [data-slot="card-header"] h3:text-is("OpenAI"))'
    );
    const apiKeyInput = providerCard.locator('#ai-provider-openai');
    const saveButton = providerCard.locator('[data-action-id="users.ai.credential.save"]');
    await expect(providerCard).toHaveCount(1);
    await apiKeyInput.fill('rs1-key-must-remain-unsaved');
    await expect(saveButton).toHaveAccessibleName('Save key');
    await saveButton.click();

    await expect(aiCredentialToast(page, 'error', 'Failed to save API key')).toBeVisible();
    await expect(apiKeyInput).toHaveValue('rs1-key-must-remain-unsaved');
    await expect(aiCredentialToast(page, 'success', 'API key saved')).toHaveCount(0);
    expect(failedRequest).toEqual({
      apiKey: 'rs1-key-must-remain-unsaved',
      provider: 'openai',
    });
  });

  test('resilience.route.agenda-deep-link-reload restores the same seeded item @nightly @resilience', async ({
    e2eRun,
    page,
    seed,
  }) => {
    expect(seed.userId).toBe(e2eRun.actorId);
    const deepLink = `/event/${seed.eventId}/agenda/${seed.agendaItemId}`;

    await page.goto(deepLink);
    await waitForAppReady(page);
    const agendaHeading = page.getByRole('heading', {
      name: seed.agendaItemTitle,
      exact: true,
    });
    await expect(agendaHeading).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page).toHaveURL(new RegExp(`${deepLink}$`));
    await expect(agendaHeading).toBeVisible();
  });
});
