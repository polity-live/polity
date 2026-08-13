import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import {
  governanceEntityId,
  seedChangeRequest,
  seedProcessBranches,
} from './fixtures/domains/governance';

test('proposes, reviews, accepts, and versions a document change @pr @critical @acceptance', async ({
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const process = await seedProcessBranches(sql, e2eRun, seed);
  const changeRequestId = await seedChangeRequest(sql, e2eRun, seed, process.mainBranchId);
  const roleId = governanceEntityId(e2eRun, 'amendment-voter-role');
  const actionRightId = governanceEntityId(e2eRun, 'amendment-vote-right');
  const suggestionContent = [
    {
      type: 'p',
      children: [
        {
          text: 'Accepted clause',
          suggestion_insert: { id: 'governance-suggestion-1', type: 'insert' },
        },
      ],
    },
  ];

  await sql`
    insert into public.role (
      id, name, description, scope, amendment_id, assignment_mode,
      visibility, assignee_kind, sort_order, created_at
    ) values (
      ${roleId}::uuid, 'Amendment voter', 'Can vote on amendment changes',
      'amendment', ${seed.amendmentId}::uuid, 'assigned', 'public', 'member', 0, now()
    );
    insert into public.action_right (
      id, resource, action, role_id, amendment_id, created_at
    ) values (
      ${actionRightId}::uuid, 'amendments', 'vote', ${roleId}::uuid,
      ${seed.amendmentId}::uuid, now()
    );
    update public.amendment_collaborator
    set role_id = ${roleId}::uuid, status = 'active'
    where amendment_id = ${seed.amendmentId}::uuid
      and user_id = ${seed.userId}::uuid;
    update public.amendment_process_branch
    set editing_mode = 'vote_internal',
        discussions = jsonb_build_array(jsonb_build_object(
          'id', 'governance-suggestion-1',
          'crId', 'CR-1',
          'changeRequestEntityId', ${changeRequestId}::text
        )),
        updated_at = now()
    where id = ${process.mainBranchId}::uuid;
    update public.document
    set content = ${JSON.stringify(suggestionContent)}::jsonb, updated_at = now()
    where id = ${process.documentId}::uuid;
    update public.change_request
    set suggestion_id = 'governance-suggestion-1',
        title = 'CR-1',
        voting_status = 'open',
        updated_at = now()
    where id = ${changeRequestId}::uuid;
  `;

  const versionCountBefore = await sql`
    select count(*)::int as count
    from public.document_version
    where document_id = ${process.documentId}::uuid
  `;

  await page.goto(`/amendment/${seed.amendmentId}/change-requests?branch=${process.mainBranchId}`);
  await waitForAppReady(page);
  const changeRequestCard = page.locator('[data-slot="card"]').filter({
    has: page.getByText('CR-1', { exact: true }),
  });
  await expect(changeRequestCard).toBeVisible();
  await changeRequestCard
    .locator('[data-action-id="agendas.change-request.internal-vote.accept"]')
    .click();

  await expect
    .poll(async () => {
      const rows = await sql`
        select status, voting_status
        from public.change_request
        where id = ${changeRequestId}::uuid
      `;
      return `${rows[0]?.status}:${rows[0]?.voting_status}`;
    })
    .toMatch(/^(accepted|approved|completed):completed$/);

  await expect
    .poll(async () => {
      const rows = await sql`
        select count(*)::int as count
        from public.document_version
        where document_id = ${process.documentId}::uuid
      `;
      return Number(rows[0]?.count ?? 0);
    })
    .toBe(Number(versionCountBefore[0]?.count ?? 0) + 1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(
    page.locator('[data-slot="card"]').filter({
      has: page.getByText('CR-1', { exact: true }),
    })
  ).toBeVisible();
});
