import { expect, test } from './fixtures/test';
import { authenticateActor, removeActorAuthState } from './fixtures/auth';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { seedActiveMembership } from './fixtures/domains/groups';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';

for (const personal of [false, true]) {
  test(`${personal ? 'personal' : 'group'} Studio suggests, comments and votes on a canvas change request @pr`, async ({
    browser,
    page,
    seed,
    e2eRun,
  }) => {
    test.setTimeout(180_000);
    const sql = db();
    const reviewer = e2eRun.actor('studio-reviewer');
    const projectId = crypto.randomUUID();
    const origin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000');
    if (origin.origin !== 'http://localhost:3000')
      throw new Error('Studio acceptance requires localhost:3000');
    const route = personal ? `/studio/${projectId}` : `/group/${seed.groupId}/studio/${projectId}`;
    const document = legacyDocumentToV3(createDocument('single', `${e2eRun.prefix} Studio`));
    const removalTarget = document.nodes.find(node => node.type === 'shape')!;
    removalTarget.name = 'Remove this accent';
    await authenticateActor(browser, reviewer);
    const reviewerContext = await browser.newContext({ storageState: reviewer.storageStatePath });
    const reviewerPage = await reviewerContext.newPage();
    try {
      // The seed's extra member is not a browser actor in this two-member flow.
      await sql`delete from group_membership where group_id=${seed.groupId} and user_id=${seed.extraUserId}`;
      const reviewerMembershipId = await seedActiveMembership(
        e2eRun.prefix,
        seed.groupId,
        reviewer.id,
        'admin'
      );
      await sql`
      insert into action_right(id, resource, action, role_id, group_id, created_at)
      select ${crypto.randomUUID()}, 'projects', 'manage', membership_role.role_id,
        ${seed.groupId}, now()
      from group_membership_role membership_role
      where membership_role.group_membership_id = ${reviewerMembershipId}
    `;
      await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${projectId},${e2eRun.actorId},${personal ? null : seed.groupId},${document.title},${document.kind},5,${Date.now()},${Date.now()})`;
      await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(document)))},${Date.now()})`;
      if (personal)
        await sql`insert into studio_project_collaborator(id,project_id,user_id,invited_by_id,status,created_at,updated_at)
      values(${crypto.randomUUID()},${projectId},${reviewer.id},${e2eRun.actorId},'active',${Date.now()},${Date.now()})`;
      await page.goto(route);
      await reviewerPage.goto(route);
      await waitForAppReady(page);
      await waitForAppReady(reviewerPage);
      for (const target of [page, reviewerPage]) {
        const acknowledge = target.getByRole('button', { name: /I understand|Verstanden/i });
        if (await acknowledge.isVisible()) await acknowledge.click();
      }
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
        page.getByText(
          'The main document is locked during the suggestion phase. You can make changes in proposal drafts.'
        )
      ).toBeVisible();
      await expect(page.getByText('You can view this project.', { exact: true })).toHaveCount(0);
      await reviewerPage
        .locator('[data-action-id="communication-studio.procedure.open-mode"]')
        .click();
      const editingMode = reviewerPage.getByRole('menuitemradio', {
        name: 'Collaborative Editing',
      });
      if (personal) await expect(editingMode).toBeDisabled();
      else await expect(editingMode).toBeEnabled();
      await reviewerPage.keyboard.press('Escape');
      await expect(
        reviewerPage.getByRole('textbox', { name: /Proposal title|Antragstitel/i })
      ).toBeVisible({ timeout: 15_000 });
      await reviewerPage
        .getByRole('textbox', { name: /Proposal title|Antragstitel/i })
        .fill('Clearer Studio title');
      await reviewerPage
        .getByRole('button', { name: /Start proposal|Vorschlag beginnen/i })
        .click();
      await expect(projectTitle(reviewerPage)).toBeEnabled();
      await projectTitle(reviewerPage).fill('Voted group design');
      await reviewerPage.getByRole('button', { name: /Layers|Ebenen/i }).click();
      await reviewerPage.getByRole('button', { name: 'Remove this accent', exact: true }).click();
      await reviewerPage.keyboard.press('Delete');
      await expect(
        reviewerPage
          .locator('div[data-change-request-tone="remove"][data-change-request-ghost="true"]')
          .first()
      ).toBeVisible();
      await expect(page.locator('[data-change-request-tone="remove"]')).toHaveCount(0);
      await expect
        .poll(async () => {
          const [row] =
            await sql`select document from canvas_proposal where project_id=${projectId} and state='draft'`;
          return (row?.document as { nodes?: { id: string }[] } | undefined)?.nodes?.some(
            node => node.id === removalTarget.id
          );
        })
        .toBe(false);
      if (await reviewerPage.getByRole('tree').isVisible())
        await reviewerPage.getByRole('button', { name: /Layers|Ebenen/i }).click();
      await reviewerPage.getByRole('button', { name: 'Frame', exact: true }).click();
      const squareFrame = reviewerPage.getByRole('menuitem', { name: /square/i });
      await expect(squareFrame).toBeEnabled({ timeout: 10_000 });
      await squareFrame.dispatchEvent('click');
      await expect(
        reviewerPage.locator('div[data-change-request-tone="add"]').first()
      ).toBeVisible();
      await reviewerPage.getByRole('button', { name: /Submit|Einreichen/i }).click();
      await expect
        .poll(async () => {
          const [row] =
            await sql`select jsonb_array_length(changes) as count from canvas_proposal where project_id=${projectId}`;
          return Number(row?.count ?? 0);
        })
        .toBeGreaterThan(1);
      await expect(
        page.getByRole('button', { name: /Clearer Studio title/i }).first()
      ).toBeVisible();
      await expect(page.locator('div[data-change-request-tone="remove"]').first()).toBeVisible();
      await page
        .getByRole('button', { name: /Clearer Studio title/i })
        .first()
        .click();
      const view = page.getByRole('group', { name: 'View' });
      await expect(view.getByRole('button', { name: 'Difference' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await view.getByRole('button', { name: 'Original' }).click();
      await expect(page.locator('[data-change-request-tone]')).toHaveCount(0);
      await view.getByRole('button', { name: 'Proposal' }).click();
      await expect(page.locator('[data-change-request-tone]')).toHaveCount(0);
      await view.getByRole('button', { name: 'Difference' }).click();
      await expect(page.locator('div[data-change-request-tone="remove"]').first()).toBeVisible();
      await page.getByRole('textbox', { name: /Comment|Kommentar/i }).fill('Looks ready');
      await page.getByRole('button', { name: /^(Comment|Kommentieren)$/i }).click();
      await expect(page.getByText('Looks ready')).toBeVisible();

      await page.locator('[data-action-id="communication-studio.procedure.open-mode"]').click();
      await page.getByRole('menuitemradio', { name: /Internal Voting|Intern.*Abstimm/i }).click();
      await page.locator('[data-action-id="communication-studio.procedure.vote.accept"]').click();
      await reviewerPage
        .getByRole('button', { name: /Clearer Studio title/i })
        .first()
        .click();
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
      await page.screenshot({
        path: personal
          ? 'output/playwright/studio-personal-procedure.png'
          : 'output/playwright/studio-group-procedure.png',
        fullPage: true,
      });
    } catch (error) {
      await page
        .screenshot({
          path: personal
            ? 'output/playwright/studio-personal-procedure-failure.png'
            : 'output/playwright/studio-group-procedure-failure.png',
          fullPage: true,
        })
        .catch(() => undefined);
      throw error;
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
}
