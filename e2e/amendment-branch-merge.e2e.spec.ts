import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { seedProcessBranches } from './fixtures/domains/governance';

test('shows two amendment branches and their persisted merge decision @pr', async ({
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const process = await seedProcessBranches(sql, e2eRun, seed, { merged: true });
  await sql`
    update public.amendment_process_branch
    set merged_into_branch_id = ${process.mainBranchId}::uuid,
        status = 'merged', resolution = 'merged', updated_at = now()
    where id = ${process.variantBranchId}::uuid
  `;

  await page.goto(`/amendment/${seed.amendmentId}/process?branch=${process.mainBranchId}`);
  await waitForAppReady(page);

  const branchSelector = page.locator('[data-action-id="amendments.branches.select.current"]');
  await expect(branchSelector).toContainText(`${e2eRun.prefix} Main branch`);
  await branchSelector.click();
  const variantBranchOption = page
    .locator('[data-action-id="amendments.branches.select.path-option"]')
    .filter({ hasText: `${e2eRun.prefix} Variant branch` });
  await expect(variantBranchOption).toBeVisible();
  await expect(variantBranchOption.getByText('merged', { exact: true })).toBeVisible();

  await expect
    .poll(async () => {
      const rows = await sql`
        select status, resolution, merged_into_branch_id::text
        from public.amendment_process_branch
        where id = ${process.variantBranchId}::uuid
      `;
      return rows[0];
    })
    .toMatchObject({
      status: 'merged',
      resolution: 'merged',
      merged_into_branch_id: process.mainBranchId,
    });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await branchSelector.click();
  await expect(variantBranchOption.getByText('merged', { exact: true })).toBeVisible();
});
