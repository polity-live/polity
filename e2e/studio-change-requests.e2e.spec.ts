import { expect, test } from './fixtures/test';
import { authenticateActor, removeActorAuthState } from './fixtures/auth';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';

test('group Studio suggests, comments and votes on a canvas change request @pr', async ({
  browser,
  page,
  seed,
  e2eRun,
}) => {
  test.setTimeout(180_000);
  const sql = db();
  const reviewer = e2eRun.actor('studio-reviewer');
  const projectId = crypto.randomUUID();
  const route = `/group/${seed.groupId}/studio/${projectId}`;
  const document = legacyDocumentToV3(createDocument('single', `${e2eRun.prefix} Studio`));
  await authenticateActor(browser, reviewer);
  const reviewerContext = await browser.newContext({ storageState: reviewer.storageStatePath });
  const reviewerPage = await reviewerContext.newPage();
  try {
    // The seed's extra member is not a browser actor in this two-member flow.
    await sql`delete from group_membership where group_id=${seed.groupId} and user_id=${seed.extraUserId}`;
    await sql`insert into group_membership(id,group_id,user_id,status) values(${crypto.randomUUID()},${seed.groupId},${reviewer.id},'admin')`;
    await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${e2eRun.actorId},${seed.groupId},${document.title},${document.kind},5,${Date.now()},${Date.now()})`;
    await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(document)))},${Date.now()})`;
    await page.goto(route);
    await reviewerPage.goto(route);
    await waitForAppReady(page);
    await waitForAppReady(reviewerPage);
    const projectTitle = (target: typeof page) =>
      target.getByRole('textbox', { name: 'Title', exact: true });
    await projectTitle(page).fill('Shared group design');
    await expect(projectTitle(reviewerPage)).toHaveValue('Shared group design');
    await expect
      .poll(async () => {
        const [row] =
          await sql`select document->>'title' as title from studio_state where project_id=${projectId}`;
        return row?.title;
      })
      .toBe('Shared group design');

    await page.locator('[data-action-id="communication-studio.procedure.open-mode"]').click();
    await page
      .getByRole('menuitemradio', { name: /Internal Suggestions|Intern.*Vorschl/i })
      .click();
    await expect(page.getByRole('button', { name: 'Internal Suggestions' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(projectTitle(reviewerPage)).toBeDisabled({ timeout: 15_000 });
    await expect(
      reviewerPage.getByRole('textbox', { name: /Proposal title|Antragstitel/i })
    ).toBeVisible({ timeout: 15_000 });
    await reviewerPage
      .getByRole('textbox', { name: /Proposal title|Antragstitel/i })
      .fill('Clearer Studio title');
    await reviewerPage.getByRole('button', { name: /Start proposal|Vorschlag beginnen/i }).click();
    await expect(projectTitle(reviewerPage)).toBeEnabled();
    await projectTitle(reviewerPage).fill('Voted group design');
    await reviewerPage.getByRole('button', { name: 'Frame', exact: true }).click();
    const squareFrame = reviewerPage.getByRole('menuitem', { name: /square/i });
    await expect(squareFrame).toBeEnabled({ timeout: 10_000 });
    await squareFrame.click();
    await reviewerPage.getByRole('button', { name: /Submit|Einreichen/i }).click();
    await expect
      .poll(async () => {
        const [row] =
          await sql`select jsonb_array_length(changes) as count from canvas_proposal where project_id=${projectId}`;
        return Number(row?.count ?? 0);
      })
      .toBeGreaterThan(1);
    await expect(page.getByRole('button', { name: /Clearer Studio title/i })).toBeVisible();
    await page.getByRole('button', { name: /Clearer Studio title/i }).click();
    await page.getByRole('textbox', { name: /Comment|Kommentar/i }).fill('Looks ready');
    await page.getByRole('button', { name: /Comment|Kommentieren/i }).click();
    await expect(page.getByText('Looks ready')).toBeVisible();

    await page.locator('[data-action-id="communication-studio.procedure.open-mode"]').click();
    await page.getByRole('menuitemradio', { name: /Internal Voting|Intern.*Abstimm/i }).click();
    await page.locator('[data-action-id="communication-studio.procedure.vote.accept"]').click();
    await reviewerPage.getByRole('button', { name: /Clearer Studio title/i }).click();
    await reviewerPage
      .locator('[data-action-id="communication-studio.procedure.vote.accept"]')
      .click();
    await expect
      .poll(
        async () => {
          const [row] =
            await sql`select state,application from canvas_proposal where project_id=${projectId}`;
          return `${row?.state}:${row?.application}`;
        },
        { timeout: 15_000 }
      )
      .toBe('closed:applied');
    await expect
      .poll(async () => {
        const [row] =
          await sql`select document->>'title' as title from studio_state where project_id=${projectId}`;
        return row?.title;
      })
      .toBe('Voted group design');
  } finally {
    await reviewerContext.close().catch(() => undefined);
    await removeActorAuthState(reviewer).catch(() => undefined);
    await sql`delete from canvas_vote where proposal_id in (select id from canvas_proposal where project_id=${projectId})`;
    await sql`delete from canvas_comment where project_id=${projectId}`;
    await sql`delete from canvas_receipt where project_id=${projectId}`;
    await sql`delete from studio_asset where project_id=${projectId}`;
    await sql`delete from canvas_proposal where project_id=${projectId}`;
    await sql`delete from studio_project where id=${projectId}`;
  }
});
