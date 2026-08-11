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

  const input = field.locator('input:not([type="hidden"]):visible');
  if (options.optional && !(await input.count())) return false;

  await expect(input).toBeVisible();
  await input.fill(label);

  const result = options.entityType
    ? page.locator(
        `[data-typeahead-entity-type="${cssAttr(options.entityType)}"][data-typeahead-result="${cssAttr(label)}"]`
      )
    : page.locator(`[data-typeahead-result="${cssAttr(label)}"]`);
  const visibleResult = result.filter({ visible: true });

  if (options.optional) {
    try {
      await expect(visibleResult).toHaveCount(1, { timeout: 5_000 });
    } catch {
      return false;
    }
    await visibleResult.click();
    return true;
  }

  await expect(visibleResult).toHaveCount(1, { timeout: 10_000 });
  await visibleResult.click();
  return true;
}
