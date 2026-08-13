import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { seedAmendmentDocument } from './fixtures/domains/governance';

test('compares document versions and restores the selected revision @nightly', async ({
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const original = `${e2eRun.prefix} original version`;
  const revised = `${e2eRun.prefix} revised version`;
  const document = await seedAmendmentDocument(sql, e2eRun, seed, [original, revised]);

  await page.goto(`/amendment/${seed.amendmentId}/text`);
  await waitForAppReady(page);
  await expect(page.locator('[data-slate-editor="true"][contenteditable="true"]')).toContainText(
    revised
  );
  await page.locator('[data-action-id="editor.version.history.open"]').click();

  const history = page.getByRole('dialog');
  await expect(history.getByText('Version 1', { exact: true })).toBeVisible();
  await expect(history.getByText('Version 2', { exact: true })).toBeVisible();
  const originalVersionRow = history.getByText('Version 1', { exact: true }).locator('xpath=../..');
  await originalVersionRow.locator('[data-action-id="editor.version.restore"]').click();

  await expect
    .poll(async () => {
      const rows = await sql`
        select content::text as content
        from public.document
        where id = ${document.documentId}::uuid
      `;
      return String(rows[0]?.content ?? '');
    })
    .toContain(original);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page.locator('[data-slate-editor="true"][contenteditable="true"]')).toContainText(
    original
  );
});
