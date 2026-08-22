import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { removeActorAuthState } from './fixtures/auth';
import { waitForAppReady } from './fixtures/readiness';
import {
  authenticateGovernanceActor,
  governanceActors,
  inviteAmendmentCollaborator,
  seedAmendmentDocument,
} from './fixtures/domains/governance';

test('invites a collaborator, edits as the second actor, and shares the change @pr', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const actors = governanceActors(e2eRun);
  const collaborator = await authenticateGovernanceActor(browser, actors, 'collaborator');
  await seedAmendmentDocument(sql, e2eRun, seed, [`${e2eRun.prefix} original document`]);
  const collaborationId = await inviteAmendmentCollaborator(sql, e2eRun, seed, collaborator);
  await sql`
    update public.amendment
    set visibility = 'private', updated_at = now()
    where id = ${seed.amendmentId}::uuid
  `;
  const collaboratorContext = await browser.newContext({
    storageState: collaborator.storageStatePath,
  });
  const collaboratorPage = await collaboratorContext.newPage();

  try {
    await collaboratorPage.goto(`/amendment/${seed.amendmentId}`);
    await waitForAppReady(collaboratorPage);
    await expect(collaboratorPage.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(collaboratorPage.locator('[data-entity-visibility="private"]')).toHaveCount(1);
    await collaboratorPage
      .locator('[data-action-id="amendments.wiki.manage.collaboration"]')
      .click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select status from public.amendment_collaborator
          where id = ${collaborationId}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toMatch(/^(active|collaborator|member)$/);

    const editedText = `${e2eRun.prefix} collaboratively edited document`;
    await collaboratorPage.goto(`/amendment/${seed.amendmentId}/text`);
    await waitForAppReady(collaboratorPage);
    const editor = collaboratorPage.locator('[data-slate-editor="true"][contenteditable="true"]');
    await expect(editor).toBeEditable();
    await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await editor.pressSequentially(editedText);

    await expect
      .poll(
        async () => {
          const rows = await sql`
          select content::text as content
          from public.document
          where amendment_id = ${seed.amendmentId}::uuid
        `;
          return String(rows[0]?.content ?? '');
        },
        { timeout: 30_000 }
      )
      .toContain(editedText);

    await page.goto(`/amendment/${seed.amendmentId}/text`);
    await waitForAppReady(page);
    await expect(page.locator('[data-slate-editor="true"][contenteditable="true"]')).toContainText(
      editedText
    );
  } finally {
    await collaboratorContext.close();
    await removeActorAuthState(collaborator);
  }
});
