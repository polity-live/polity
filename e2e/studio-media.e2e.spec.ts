import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { createStudioProject, startStudioExportWorker } from './fixtures/studio';
import { waitForAppReady } from './fixtures/readiness';
import { createClient } from '@supabase/supabase-js';

test.use({ actionTimeout: 30_000 });

test('uploads, maintains an element library, clones media, exports and hands off through Zero @pr', async ({
  page,
  e2eRun,
}) => {
  test.setTimeout(240_000);
  const sql = db();
  const projects: string[] = [];
  const obsoleteRequests: string[] = [];
  const worker = await startStudioExportWorker();
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/studio' || path.startsWith('/api/studio/read/')) obsoleteRequests.push(path);
  });
  try {
    const projectId = await createStudioProject(page, `${e2eRun.prefix} Media`);
    projects.push(projectId);
    e2eRun.registerEntityId(projectId);
    await waitForAppReady(page);
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeEnabled();
    const acknowledge = page.getByRole('button', { name: 'I understand', exact: true });
    if (await acknowledge.isVisible()) await acknowledge.click();
    await page.locator('input[type="file"][aria-label="Upload media"]').setInputFiles({
      name: 'zero-pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=',
        'base64'
      ),
    });
    await expect
      .poll(
        async () => {
          const [row] =
            await sql`select count(*)::int as n from studio_asset where project_id=${projectId} and ready`;
          return row.n;
        },
        { timeout: 30_000 }
      )
      .toBe(1);
    await expect
      .poll(
        async () => {
          const [row] = await sql`select document from studio_state where project_id=${projectId}`;
          return row.document.nodes.filter((node: { type: string }) => node.type === 'media')
            .length;
        },
        { timeout: 30_000 }
      )
      .toBe(1);

    await page.locator('[data-navigation-item-id="studio-elements"]').click();
    await page.locator('[data-action-id="communication-studio.elements.selection.save"]').click();
    await expect
      .poll(
        async () => {
          const [row] =
            await sql`select count(*)::int as n from studio_element_set where owner_id=${e2eRun.actorId}`;
          return row.n;
        },
        { timeout: 30_000 }
      )
      .toBe(1);
    const [set] = await sql`select id from studio_element_set where owner_id=${e2eRun.actorId}`;
    page.once('dialog', dialog => dialog.accept('Zero media library'));
    await page.locator('[data-action-id="communication-studio.elements.set.rename"]').click();
    await expect(page.getByText('Zero media library', { exact: true })).toBeVisible();
    const transfer = await page.evaluateHandle(id => {
      const data = new DataTransfer();
      data.setData('application/x-polity-element-set', id);
      return data;
    }, set.id as string);
    const canvas = page.getByTestId('studio-canvas');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Studio canvas is unavailable');
    await canvas.dispatchEvent('drop', {
      dataTransfer: transfer,
      clientX: bounds.x + 100,
      clientY: bounds.y + 100,
    });
    await transfer.dispose();
    await expect
      .poll(
        async () => {
          const [row] = await sql`select document from studio_state where project_id=${projectId}`;
          return row.document.componentInstances.length;
        },
        { timeout: 30_000 }
      )
      .toBe(1);
    await page.locator('[data-action-id="communication-studio.elements.instance.publish"]').click();
    await expect
      .poll(
        async () => {
          const [row] =
            await sql`select max(version)::int as n from studio_element_set_revision where set_id=${set.id}`;
          return row.n;
        },
        { timeout: 30_000 }
      )
      .toBe(2);
    await page.locator('[data-action-id="communication-studio.elements.set.archive"]').click();
    await expect(page.getByText('Zero media library', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Copy project', exact: true }).press('Enter');
    await page.locator('[data-action-id="studio.project.clone.submit"]').click();
    await expect(page).not.toHaveURL(new RegExp(`/studio/${projectId}/?$`), { timeout: 30_000 });
    await expect(page).toHaveURL(/\/studio\/[a-f0-9-]{36}\/?$/);
    const cloneId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!;
    projects.push(cloneId);
    e2eRun.registerEntityId(cloneId);
    await waitForAppReady(page);
    expect(
      await sql`select id from studio_asset where project_id=${cloneId} and ready`
    ).toHaveLength(2);
    await page.getByRole('button', { name: 'Downloads', exact: true }).click();
    await page
      .locator('[data-action-id="communication-studio.studioworkspace.activate.format-2"]')
      .selectOption('png');
    await page
      .locator('[data-action-id="communication-studio.studio-workspace.export-media"]')
      .click();
    await expect
      .poll(
        async () => {
          const [row] =
            await sql`select status from studio_export where project_id=${cloneId} order by created_at desc limit 1`;
          worker.assertRunning();
          return row?.status;
        },
        { timeout: 90_000 }
      )
      .toBe('completed');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .locator(
          '[data-action-id="communication-studio.studioworkspace.activate.button-fdbeb1cd6b"]'
        )
        .click(),
    ]);
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    await page.addInitScript(() => {
      (window as unknown as Window & { studioHandoff: unknown }).studioHandoff = JSON.parse(
        sessionStorage.getItem('studio:post') ?? 'null'
      );
    });
    await page
      .locator('[data-action-id="communication-studio.studioworkspace.activate.button-07f95dca6d"]')
      .click();
    await expect(page).toHaveURL(/\/create\/statement/);
    const handoff = await page.evaluate(
      () =>
        (window as unknown as Window & { studioHandoff: { imageUrl: string; projectId: string } })
          .studioHandoff
    );
    expect(handoff).toMatchObject({ projectId: cloneId });
    expect(handoff.imageUrl).toMatch(/^\/api\/studio\/published-media\//);
    expect(obsoleteRequests).toEqual([]);
  } finally {
    await worker.stop();
    const created =
      await sql`select id from studio_project where owner_id=${e2eRun.actorId} and title=${`${e2eRun.prefix} Media`}`;
    for (const row of created) if (!projects.includes(row.id)) projects.push(row.id);
    const files =
      await sql`select storage_path from studio_asset where project_id=any(${projects}::uuid[])
      union select storage_path from studio_export where project_id=any(${projects}::uuid[]) and storage_path is not null
      union select a.storage_path from studio_element_set_asset a join studio_element_set_revision r on r.id=a.revision_id join studio_element_set s on s.id=r.set_id where s.owner_id=${e2eRun.actorId}`;
    await sql.begin(async tx => {
      await tx`set local session_replication_role = replica`;
      await tx`delete from studio_element_set_asset where revision_id in (select r.id from studio_element_set_revision r join studio_element_set s on s.id=r.set_id where s.owner_id=${e2eRun.actorId})`;
      await tx`delete from studio_element_set_revision where set_id in (select id from studio_element_set where owner_id=${e2eRun.actorId})`;
      await tx`delete from studio_element_set where owner_id=${e2eRun.actorId}`;
      for (const id of projects) {
        await tx`delete from studio_revision where project_id=${id}`;
      }
      await tx`set local session_replication_role = origin`;
      for (const id of projects) await tx`delete from studio_project where id=${id}`;
    });
    if (files.length) {
      const admin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const result = await admin.storage
        .from('studio')
        .remove(files.map(file => file.storage_path));
      expect(result.error).toBeNull();
    }
  }
});
