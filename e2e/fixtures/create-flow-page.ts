import { expect, type Page } from '@playwright/test';
import { FormActions } from './form-actions';
import { selectTypeahead } from './typeahead';

export type CreateFormStyle = 'one_page' | 'carousel' | 'auto';

const DEFAULT_FINALIZATION_TIMEOUT_MS = 240_000;
const CREATE_READY_TIMEOUT_MS = 60_000;

export interface CreateSubmitTargetMetadata {
  kind: string | null;
  to: string | null;
  paramsRaw: string | null;
  params: Record<string, unknown>;
  href: string | null;
  id: string | null;
}

export interface SubmitWaitForSavedAndNavigateOptions {
  expectedUrl: string | RegExp;
  expectTargetVisible?: (target: CreateSubmitTargetMetadata) => Promise<void>;
  verifyCreatedRecord?: (target: CreateSubmitTargetMetadata) => Promise<void>;
}

export function createFinalizationTimeoutMs() {
  const configured = Number(process.env.E2E_CREATE_FINALIZATION_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_FINALIZATION_TIMEOUT_MS;
}

export function createSmokeTestTimeoutMs() {
  return Math.max(createFinalizationTimeoutMs() + 60_000, 120_000);
}

async function visible(locator: ReturnType<Page['locator']>, timeout = 500) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function recoverAppBoot(page: Page, attempt: number) {
  const retry = page.getByRole('button', { name: 'Retry' }).first();
  if (await visible(retry)) {
    await retry.click().catch(() => undefined);
    await page.waitForTimeout(1_000);
  }

  if (attempt % 3 === 0) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
  }
}

function clearCreateRecoverySessionStateInBrowser() {
  try {
    const recoveryPrefix = 'polity:create:recovery:';
    const restoreKey = 'polity:create:restore';

    window.sessionStorage.removeItem(restoreKey);
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(recoveryPrefix)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore pages that do not expose sessionStorage yet.
  }
}

export async function clearCreateRecoverySessionStateForPage(page: Page) {
  await page.addInitScript(clearCreateRecoverySessionStateInBrowser);
  await page.evaluate(clearCreateRecoverySessionStateInBrowser).catch(() => undefined);
}

function parseTargetParams(raw: string | null) {
  if (!raw) return {};

  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function targetIdFrom(params: Record<string, unknown>, href: string | null) {
  if (typeof params.id === 'string' && params.id) return params.id;

  const match = href?.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  return match?.[0] ?? null;
}

function targetMetadataString(target: CreateSubmitTargetMetadata, currentUrl?: string) {
  return `kind=${target.kind ?? 'missing'}, to=${target.to ?? 'missing'}, params=${target.paramsRaw ?? 'missing'}, href=${target.href ?? 'missing'}, currentUrl=${currentUrl ?? 'unknown'}`;
}

export async function waitForCreateReady(
  page: Page,
  readyLocator: ReturnType<Page['locator']>,
  timeout = CREATE_READY_TIMEOUT_MS
) {
  const deadline = Date.now() + timeout;
  let attempt = 0;

  while (Date.now() < deadline) {
    if (await visible(readyLocator)) return;

    const stillConnecting = page.getByRole('heading', { name: 'Still connecting' }).first();
    if (await visible(stillConnecting, 250)) {
      attempt += 1;
      await recoverAppBoot(page, attempt);
    } else {
      await page.waitForTimeout(500);
    }
  }

  await expect(readyLocator).toBeVisible({ timeout: 1_000 });
}

export async function waitForCreateDashboardReady(page: Page, timeout = CREATE_READY_TIMEOUT_MS) {
  await waitForCreateReady(
    page,
    page.locator('[data-create-action="open-create-flow"]').first(),
    timeout
  );
}

export class CreateFlowPage {
  readonly form: FormActions;
  private recoverySessionStateClearerInstalled = false;

  constructor(readonly page: Page) {
    this.form = new FormActions(page);
  }

  async goto(path: string, style: CreateFormStyle = 'one_page') {
    await this.installCreateRecoverySessionStateClearer();
    await this.page.goto(path);
    await waitForCreateReady(this.page, this.page.locator('[data-create-flow]'));
    await this.setFormStyle(style);
  }

  async setFormStyle(style: CreateFormStyle) {
    const button = this.page.locator(
      `[data-create-action="set-form-style"][data-create-option="${style}"]`
    );

    if (await button.count()) {
      await button.click();
      if (style !== 'auto') {
        await expect(this.page.locator(`[data-create-layout="${style}"]`)).toBeVisible({
          timeout: 10_000,
        });
      }
    }
  }

  async selectTypeahead(
    fieldKey: string,
    label: string,
    options: { entityType?: string; optional?: boolean } = {}
  ) {
    return selectTypeahead(this.page, fieldKey, label, options);
  }

  async expectLoaded(flow: string) {
    await expect(this.page.locator(`[data-create-flow="${flow}"]`)).toBeVisible();
  }

  async submitAndWaitReady() {
    await this.form.submit();
    await this.form.waitForSubmissionReady();
  }

  async submitWaitForSavedAndNavigate(options: SubmitWaitForSavedAndNavigateOptions) {
    await this.form.submit();

    await this.waitForFinalizationStartedOrSaved();
    await this.form.waitForSubmissionReady();

    const navigateButton = this.page
      .locator('[data-create-action="navigate-created-target"]')
      .first();
    const targetKind = await navigateButton.getAttribute('data-create-target-kind');
    const targetTo = await navigateButton.getAttribute('data-create-target-to');
    const targetParams = await navigateButton.getAttribute('data-create-target-params');
    const targetHref = await navigateButton.getAttribute('href');
    await expect(navigateButton).toHaveAttribute('href', /.+/);
    const parsedTargetParams = parseTargetParams(targetParams);
    const target: CreateSubmitTargetMetadata = {
      kind: targetKind,
      to: targetTo,
      paramsRaw: targetParams,
      params: parsedTargetParams,
      href: targetHref,
      id: targetIdFrom(parsedTargetParams, targetHref),
    };

    const documentMarker = `create-spa-${Date.now()}-${Math.random()}`;
    if (targetKind === 'route') {
      await this.page.evaluate(marker => {
        (
          window as typeof window & { __createSpaNavigationMarker?: string }
        ).__createSpaNavigationMarker = marker;
      }, documentMarker);
    }

    await navigateButton.click();

    try {
      await expect(this.page).toHaveURL(options.expectedUrl, { timeout: 5_000 });
    } catch (error) {
      throw new Error(
        `Create target client navigation did not reach the expected URL. Rendered target: ${targetMetadataString(target, this.page.url())}.`,
        { cause: error }
      );
    }

    if (targetKind === 'route') {
      const markerAfterNavigation = await this.page.evaluate(
        () =>
          (window as typeof window & { __createSpaNavigationMarker?: string })
            .__createSpaNavigationMarker
      );
      expect(markerAfterNavigation).toBe(documentMarker);
    }

    await expect(this.page.locator('[data-slot="create-submission-overlay"]')).toBeHidden({
      timeout: 5_000,
    });
    await options.verifyCreatedRecord?.(target);
    await options.expectTargetVisible?.(target);
    await this.expectPrimarySearchLinkStillNavigates();
  }

  private async installCreateRecoverySessionStateClearer() {
    if (!this.recoverySessionStateClearerInstalled) {
      await this.page.addInitScript(clearCreateRecoverySessionStateInBrowser);
      this.recoverySessionStateClearerInstalled = true;
    }

    await this.page.evaluate(clearCreateRecoverySessionStateInBrowser).catch(() => undefined);
  }

  private finalizationSavedToast() {
    return this.page.getByTestId('create-finalization-saved-toast').first();
  }

  private finalizationLoadingToast() {
    return this.page
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Finalizing creation in the background' })
      .first();
  }

  private async waitForFinalizationStartedOrSaved() {
    await Promise.any([
      expect(this.finalizationLoadingToast()).toBeVisible({ timeout: 15_000 }),
      expect(this.finalizationSavedToast()).toBeVisible({ timeout: 15_000 }),
    ]).catch(() => undefined);
  }

  private async expectPrimarySearchLinkStillNavigates() {
    const searchLink = this.page.locator('a[href="/search"]').first();
    await expect(searchLink).toBeVisible({ timeout: 10_000 });
    await expect(searchLink).toHaveAttribute('href', '/search');
    await searchLink.click();
    await expect(this.page).toHaveURL(/\/search(?:[?#].*)?$/, { timeout: 5_000 });
  }
}
