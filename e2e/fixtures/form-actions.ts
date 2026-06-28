import { expect, type Locator, type Page } from '@playwright/test';

function cssAttr(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function fieldLocator(page: Page, fieldKey: string) {
  return page.locator(`[data-create-field="${cssAttr(fieldKey)}"]`);
}

export class FormActions {
  constructor(private readonly page: Page) {}

  field(fieldKey: string) {
    return fieldLocator(this.page, fieldKey);
  }

  async expectField(fieldKey: string) {
    await expect(this.field(fieldKey)).toBeVisible();
  }

  async fillText(fieldKey: string, value: string, options: { optional?: boolean } = {}) {
    const field = this.field(fieldKey);
    if (options.optional && !(await field.count())) return false;

    const control = field
      .locator(
        'textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]), [contenteditable="true"]'
      )
      .first();

    if (options.optional && !(await control.count())) return false;
    await expect(control).toBeVisible();

    const contentEditable = await control.evaluate(
      element => element.getAttribute('contenteditable') === 'true'
    );

    if (contentEditable) {
      await control.click();
      await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await this.page.keyboard.type(value);
    } else {
      await control.fill(value);
    }

    return true;
  }

  async chooseOption(fieldKey: string, value: string, options: { optional?: boolean } = {}) {
    const field = this.field(fieldKey);
    if (options.optional && !(await field.count())) return false;

    const fieldOption = field.locator(`[data-create-option="${cssAttr(value)}"]`).first();
    if (await fieldOption.count()) {
      await fieldOption.click();
      return true;
    }

    const trigger = field.locator('button[role="combobox"], [data-slot="select-trigger"]').first();
    if (options.optional && !(await trigger.count())) return false;

    await expect(trigger).toBeVisible();
    await trigger.click();

    const portalOption = this.page.locator(`[data-create-option="${cssAttr(value)}"]`).last();
    await expect(portalOption).toBeVisible();
    await portalOption.click();
    return true;
  }

  async chooseGlobalOption(value: string) {
    await this.page
      .locator(`[data-create-option="${cssAttr(value)}"]`)
      .first()
      .click();
  }

  async setChecked(fieldKey: string, checked: boolean, options: { optional?: boolean } = {}) {
    const field = this.field(fieldKey);
    if (options.optional && !(await field.count())) return false;

    const control = field
      .locator(
        'button[role="switch"], input[type="checkbox"], [role="checkbox"], button[aria-pressed]'
      )
      .first();

    if (options.optional && !(await control.count())) return false;
    await expect(control).toBeVisible();

    const role = await control.getAttribute('role');
    if (role === 'switch' || role === 'checkbox') {
      const current = (await control.getAttribute('aria-checked')) === 'true';
      if (current !== checked) await control.click();
      return true;
    }

    const pressed = (await control.getAttribute('aria-pressed')) === 'true';
    if (pressed !== checked) await control.click();
    return true;
  }

  async submit() {
    const submit = this.page.locator('[data-create-action="submit"]').last();

    for (let index = 0; index < 12; index += 1) {
      if ((await submit.count()) && (await submit.isVisible())) {
        await submit.click();
        return;
      }

      const next = this.page.locator('[data-create-action="next-step"]').last();
      if ((await next.count()) && (await next.isVisible())) {
        await next.click();
      } else {
        break;
      }
    }

    await submit.click();
  }

  async expectSubmitDisabled() {
    await expect(this.page.locator('[data-create-action="submit"]').last()).toBeDisabled();
  }

  async waitForSubmissionReady() {
    await expect(this.page.locator('[data-slot="create-submission-overlay"]')).toBeVisible({
      timeout: 20_000,
    });
    const navigateTarget = this.page.locator('[data-create-action="navigate-created-target"]');
    await expect(navigateTarget).toHaveCount(1, { timeout: 10_000 });
    await expect(navigateTarget.first()).toBeEnabled({
      timeout: 20_000,
    });
  }
}

export type { Locator };
