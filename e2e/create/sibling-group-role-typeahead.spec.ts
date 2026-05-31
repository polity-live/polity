import { test, expect } from '../fixtures/test-base';
import type { Locator, Page } from '@playwright/test';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTypeaheadField(page: Page, label: string | RegExp): Locator {
  return page.locator('label', { hasText: label }).locator('..');
}

async function selectTypeaheadOption(
  page: Page,
  field: Locator,
  searchValue: string,
  optionLabel: string
): Promise<void> {
  await field.getByRole('textbox').fill(searchValue);

  const option = page
    .locator('[data-typeahead-portal]')
    .getByRole('button', { name: new RegExp(escapeRegex(optionLabel), 'i') })
    .first();

  await expect(option).toBeVisible();
  await option.click();
}

test.describe('Create sibling groups', () => {
  test('loads connected group roles and clears stale role selection when the group changes', async ({
    authenticatedPage: page,
    adminDb,
    groupFactory,
    mainUserId,
  }) => {
    const uniqueSuffix = Date.now();
    const firstGroup = await groupFactory.createGroup(mainUserId, {
      name: `Sibling Source Alpha ${uniqueSuffix}`,
    });
    const secondGroup = await groupFactory.createGroup(mainUserId, {
      name: `Sibling Source Beta ${uniqueSuffix}`,
    });

    const firstRoleName = `Alpha Delegate ${uniqueSuffix}`;
    const secondRoleName = `Beta Delegate ${uniqueSuffix}`;

    await adminDb.from('role').update({ name: firstRoleName }).eq('id', firstGroup.memberRoleId);
    await adminDb.from('role').update({ name: secondRoleName }).eq('id', secondGroup.memberRoleId);

    await page.goto('/create/group');
    await page.locator('#group-name').fill(`Sibling Group ${uniqueSuffix}`);
    await page.locator('label[for="group-type-sibling"]').click();
    await page.getByRole('button', { name: /^(Next|Weiter)$/ }).click();

    const connectedGroupField = getTypeaheadField(page, /Gruppe auswählen|Select Group/);
    await selectTypeaheadOption(page, connectedGroupField, firstGroup.name, firstGroup.name);

    await page.locator('label[for="sibling-mode-elected"]').click();

    const connectedRoleField = getTypeaheadField(page, 'Verbundene Rolle');
    await expect(connectedRoleField.getByRole('textbox')).toBeVisible();
    await selectTypeaheadOption(page, connectedRoleField, firstRoleName, firstRoleName);
    await expect(connectedRoleField.locator('[data-slot="typeahead-selected"]')).toContainText(
      firstRoleName
    );

    await connectedGroupField
      .getByRole('button', { name: new RegExp(`Remove ${escapeRegex(firstGroup.name)}`) })
      .click();

    await selectTypeaheadOption(page, connectedGroupField, secondGroup.name, secondGroup.name);
    await page.locator('label[for="sibling-mode-elected"]').click();

    await expect(connectedRoleField.locator('[data-slot="typeahead-selected"]')).toHaveCount(0);
    await connectedRoleField.getByRole('textbox').fill(firstRoleName);
    await expect(page.locator('[data-typeahead-portal]')).toContainText('No results found');

    await selectTypeaheadOption(page, connectedRoleField, secondRoleName, secondRoleName);
    await expect(connectedRoleField.locator('[data-slot="typeahead-selected"]')).toContainText(
      secondRoleName
    );
  });
});
