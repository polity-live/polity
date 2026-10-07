import { dbProvider } from '@/zero/db-provider';
import { studioQueries } from '@/zero/communication-studio/queries';
import { expect, test } from './fixtures/test';
import { authenticateActor, removeActorAuthState } from './fixtures/auth';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';

test('personal Studio invitation requires acceptance before a second actor can edit @pr', async ({
  browser,
  page,
  e2eRun,
}) => {
  test.setTimeout(180_000);
  const sql = db();
  const invited = e2eRun.actor('studio-invitee');
  const projectId = crypto.randomUUID();
  const document = legacyDocumentToV3(createDocument('single', `${e2eRun.prefix} Personal Studio`));
  await authenticateActor(browser, invited);
  const invitedContext = await browser.newContext({ storageState: invited.storageStatePath });
  const invitedPage = await invitedContext.newPage();
  try {
    await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at)
      values(${projectId},${e2eRun.actorId},null,${document.title},${document.kind},5,${Date.now()},${Date.now()})`;
    await sql`insert into studio_state(project_id,document,updated_at)
      values(${projectId},${sql.json(JSON.parse(JSON.stringify(document)))},${Date.now()})`;
    await page.goto(`/studio/${projectId}`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="studio.collaborator-invite.open"]').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/Search by name|Nach Name/i).fill(invited.email);
    await dialog.getByRole('button', { name: /E2E Test Actor/i }).click();
    await dialog.locator('[data-action-id="studio.collaborator-invite.submit"]').click();
    await expect
      .poll(async () => {
        const [row] = await sql`select status from studio_project_collaborator
        where project_id=${projectId} and user_id=${invited.id}`;
        return row?.status;
      })
      .toBe('invited');
    await expect
      .poll(async () => {
        const [row] = await sql`select count(*)::int as count from notification
          where recipient_id=${invited.id} and type='studio_collaboration_invite'
            and action_url='/studio'`;
        return row?.count ?? 0;
      })
      .toBeGreaterThan(0);
    const [before] =
      await sql`select studio_access(${invited.id}::uuid,${projectId}::uuid,true) as allowed`;
    expect(before.allowed).toBe(false);
    await dialog.getByRole('button', { name: /Cancel|Abbrechen/i }).click();

    await invitedPage.goto('/studio');
    await waitForAppReady(invitedPage);
    await expect(invitedPage.getByText(document.title)).toBeVisible();
    await invitedPage.getByRole('button', { name: /Accept|Annehmen/i }).click();
    await expect
      .poll(async () => {
        const [row] = await sql`select status from studio_project_collaborator
        where project_id=${projectId} and user_id=${invited.id}`;
        return row?.status;
      })
      .toBe('active');
    expect(
      await dbProvider.transaction(tx =>
        tx.run(
          studioQueries.list.fn({ args: { groupId: null }, ctx: { userID: invited.id, email: '' } })
        )
      )
    ).toContainEqual(expect.objectContaining({ id: projectId }));
    await expect(
      invitedPage.getByRole('link', {
        name: new RegExp(document.title + '.*(Shared with me|Mit mir geteilt)', 'i'),
      })
    ).toBeVisible({ timeout: 15_000 });
    await invitedPage.goto(`/studio/${projectId}`);
    await waitForAppReady(invitedPage);
    const title = invitedPage.getByRole('textbox', { name: 'Title', exact: true });
    await expect(title).toBeEnabled();
    await expect(
      invitedPage.locator('[data-action-id="studio.collaborator-invite.open"]')
    ).toHaveCount(0);
    await title.fill(`${e2eRun.prefix} Shared Studio edit`);
    await expect
      .poll(async () => {
        const [row] =
          await sql`select document->>'title' as title from studio_state where project_id=${projectId}`;
        return row?.title;
      })
      .toBe(`${e2eRun.prefix} Shared Studio edit`);
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      `${e2eRun.prefix} Shared Studio edit`
    );
    await page.locator('[data-action-id="studio.collaborator-invite.open"]').click();
    const ownerDialog = page.getByRole('dialog');
    await expect(ownerDialog.getByText(/Active|Aktiv/i)).toBeVisible();
    await ownerDialog.getByRole('button', { name: /Remove|Entfernen/i }).press('Enter');
    await expect
      .poll(
        async () => {
          const rows =
            await sql`select id from studio_project_collaborator where project_id=${projectId} and user_id=${invited.id}`;
          return rows.length;
        },
        { timeout: 30_000 }
      )
      .toBe(0);
    await expect
      .poll(
        async () => {
          const [row] =
            await sql`select studio_access(${invited.id}::uuid,${projectId}::uuid,true) as allowed`;
          return row?.allowed;
        },
        { timeout: 30_000 }
      )
      .toBe(false);
    await expect(invitedPage.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
    await expect(invitedPage.getByRole('alert')).toBeVisible();
  } finally {
    await invitedContext.close();
    await sql`delete from studio_project where id=${projectId}`;
    await removeActorAuthState(invited);
  }
});
