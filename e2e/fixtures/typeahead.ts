import { expect, type Page } from '@playwright/test';
import { fieldLocator } from './form-actions';

function cssAttr(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function selectTypeahead(
  page: Page,
  fieldKey: string,
  label: string,
  options: { entityType?: string; optional?: boolean } = {}
) {
  const field = fieldLocator(page, fieldKey);
  if (options.optional && !(await field.count())) return false;

  const input = field.locator('input:not([type="hidden"])').first();
  if (options.optional && !(await input.count())) return false;

  await expect(input).toBeVisible();
  await input.fill(label);

  const byType = options.entityType
    ? page.locator(
        `[data-typeahead-entity-type="${cssAttr(options.entityType)}"][data-typeahead-result]`
      )
    : page.locator('[data-typeahead-result]');
  const result = byType.filter({ hasText: label }).first();

  if (options.optional) {
    try {
      await expect(result).toBeVisible({ timeout: 5_000 });
    } catch {
      return false;
    }
    await result.click();
    return true;
  }

  await expect(result).toBeVisible({ timeout: 10_000 });
  await result.click();
  return true;
}
