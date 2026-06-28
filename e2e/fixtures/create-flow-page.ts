import { expect, type Locator, type Page } from '@playwright/test';
import { FormActions } from './form-actions';
import { selectTypeahead } from './typeahead';

export type CreateFormStyle = 'one_page' | 'carousel' | 'auto';

const DEFAULT_FINALIZATION_TIMEOUT_MS = 240_000;

export interface SubmitWaitForSavedAndNavigateOptions {
  expectedUrl: string | RegExp;
  expectTargetVisible?: () => Promise<void>;
  verifyCreatedRecord?: () => Promise<void>;
  finalizationTimeoutMs?: number;
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

export class CreateFlowPage {
  readonly form: FormActions;

  constructor(readonly page: Page) {
    this.form = new FormActions(page);
  }

  async goto(path: string, style: CreateFormStyle = 'one_page') {
    await this.page.goto(path);
    await expect(this.page.locator('[data-create-flow]')).toBeVisible({ timeout: 40_000 });
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
    const finalizationTimeoutMs = options.finalizationTimeoutMs ?? createFinalizationTimeoutMs();

    await this.form.submit();

    const savedToastPromise = this.waitForFinalizationSavedToast(finalizationTimeoutMs);

    await this.waitForFinalizationStartedOrSaved();
    await this.form.waitForSubmissionReady();
    const navigateButton = this.page
      .locator('[data-create-action="navigate-created-target"]')
      .first();
    const targetKind = await navigateButton.getAttribute('data-create-target-kind');
    const targetTo = await navigateButton.getAttribute('data-create-target-to');
    const targetParams = await navigateButton.getAttribute('data-create-target-params');
    const targetHref = await navigateButton.getAttribute('href');
    await navigateButton.click();

    try {
      await expect(this.page).toHaveURL(options.expectedUrl, { timeout: 5_000 });
    } catch (error) {
      if (!targetHref) {
        throw new Error(
          `Create target navigation did not reach the expected URL. Rendered target: kind=${targetKind ?? 'missing'}, to=${targetTo ?? 'missing'}, params=${targetParams ?? 'missing'}, href=missing.`,
          { cause: error }
        );
      }

      await savedToastPromise;
      await this.page.goto(targetHref);
      try {
        await expect(this.page).toHaveURL(options.expectedUrl, { timeout: 60_000 });
      } catch (fallbackError) {
        throw new Error(
          `Create target navigation did not reach the expected URL. Rendered target: kind=${targetKind ?? 'missing'}, to=${targetTo ?? 'missing'}, params=${targetParams ?? 'missing'}, href=${targetHref}.`,
          { cause: fallbackError }
        );
      }
    }

    await savedToastPromise;
    await options.expectTargetVisible?.();
    await options.verifyCreatedRecord?.();
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
    ]).catch(error => {
      throw new Error(
        'Expected create finalization to show either the background loading toast or the Saved toast.',
        { cause: error }
      );
    });
  }

  private async waitForFinalizationSavedToast(timeout: number): Promise<Locator> {
    const savedToast = this.finalizationSavedToast();

    await expect(savedToast).toBeVisible({ timeout });
    await expect(savedToast).toHaveAttribute('data-type', 'success');
    await expect(savedToast.locator('[data-create-finalization-toast="saved"]').first()).toHaveText(
      'Saved'
    );
    await expect(
      savedToast.locator('[data-create-finalization-icon="check"]').first()
    ).toBeVisible();

    return savedToast;
  }
}
