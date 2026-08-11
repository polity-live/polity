import { expect, test } from '../fixtures/test';
import { db } from '../fixtures/db';
import { waitForAppReady } from '../fixtures/readiness';
import { deterministicE2EUuid } from '../fixtures/run';

test.describe('critical amendment lifecycle', () => {
  test('edits and reloads persisted amendment metadata @pr @critical', async ({
    e2eRun,
    page,
    seed,
  }) => {
    const sql = db();
    const updatedTitle = `${e2eRun.prefix} Edited Amendment`;

    await page.goto(`/amendment/${seed.amendmentId}/settings`);
    await waitForAppReady(page);
    await page.locator('#title').fill(updatedTitle);
    await page.locator('button[data-action-id="amendments.edit.submit.form"]').click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select title from public.amendment where id = ${seed.amendmentId}::uuid
        `;
        return rows[0]?.title ?? null;
      })
      .toBe(updatedTitle);

    await page.goto(`/amendment/${seed.amendmentId}/settings`);
    await waitForAppReady(page);
    await expect(page.locator('#title')).toHaveValue(updatedTitle);
  });

  test('creates a persisted cross-group amendment path through the UI @pr @critical', async ({
    e2eRun,
    page,
    seed,
  }) => {
    const sql = db();
    const connectionId = deterministicE2EUuid(`${e2eRun.prefix}:amendment-path-connection`);
    const grantId = deterministicE2EUuid(`${e2eRun.prefix}:amendment-path-grant`);
    const hierarchyPathId = deterministicE2EUuid(`${e2eRun.prefix}:amendment-hierarchy-path`);

    await sql`
      insert into public.group_connection (
        id, group_a_id, group_b_id, connection_type, from_group_id, to_group_id,
        connection_kind, parent_group_id, child_group_id, status, created_by_id,
        created_at, updated_at
      ) values (
        ${connectionId}::uuid,
        least(${seed.groupId}::uuid, ${seed.hierarchicalGroupId}::uuid),
        greatest(${seed.groupId}::uuid, ${seed.hierarchicalGroupId}::uuid),
        'hierarchy', ${seed.groupId}::uuid, ${seed.hierarchicalGroupId}::uuid,
        'hierarchy', ${seed.hierarchicalGroupId}::uuid, ${seed.groupId}::uuid,
        'active', ${seed.userId}::uuid, now(), now()
      );

      insert into public.group_right_grant (
        id, connection_id, right_key, holder_group_id, scope_group_id, status,
        initiator_group_id, created_at, updated_at
      ) values (
        ${grantId}::uuid, ${connectionId}::uuid, 'amendmentRight',
        ${seed.groupId}::uuid, ${seed.hierarchicalGroupId}::uuid, 'active',
        ${seed.groupId}::uuid, now(), now()
      );

      insert into public.group_hierarchy_path (
        id, ancestor_group_id, descendant_group_id, direct_child_group_id,
        base_group_id, depth, path_group_ids, status, connection_id, created_at, updated_at
      ) values (
        ${hierarchyPathId}::uuid, ${seed.hierarchicalGroupId}::uuid,
        ${seed.groupId}::uuid, ${seed.groupId}::uuid, ${seed.groupId}::uuid,
        1, array[${seed.groupId}::uuid, ${seed.hierarchicalGroupId}::uuid],
        'active', ${connectionId}::uuid, now(), now()
      );
    `;

    await page.goto(`/amendment/${seed.amendmentId}/process`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="amendments.process-path.open.selector"]').click();

    const dialog = page.getByRole('dialog');
    const sourceInput = dialog.locator(
      '[data-tutorial-anchor="tutorial-process-start-group"] input'
    );
    await expect(sourceInput).toBeVisible();
    await sourceInput.fill(seed.groupName);
    const sourceResult = dialog
      .locator('[data-typeahead-result]')
      .filter({ hasText: seed.groupName });
    await expect(sourceResult).toHaveCount(1);
    await sourceResult.click();

    const targetInput = dialog.locator(
      '[data-tutorial-anchor="tutorial-process-target-group"] input'
    );
    await expect(targetInput).toBeVisible();
    await targetInput.fill(seed.hierarchicalGroupName);
    const targetResult = dialog
      .locator('[data-typeahead-result]')
      .filter({ hasText: seed.hierarchicalGroupName });
    await expect(targetResult).toHaveCount(1);
    await targetResult.click();

    const confirm = dialog.locator('[data-action-id="amendments.process-selection.confirm.path"]');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select selected_source_group_id, selected_target_group_id
          from public.amendment_process_run
          where amendment_id = ${seed.amendmentId}::uuid
          order by created_at desc
          limit 1
        `;
        return rows[0]
          ? `${rows[0].selected_source_group_id}:${rows[0].selected_target_group_id}`
          : null;
      })
      .toBe(`${seed.groupId}:${seed.hierarchicalGroupId}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(
      page.getByRole('link', { name: seed.hierarchicalGroupName, exact: true })
    ).toBeVisible();
  });
});
