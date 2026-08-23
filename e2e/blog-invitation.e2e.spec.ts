import { expect, test } from './fixtures/test';
import { removeActorAuthState } from './fixtures/auth';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import {
  authenticateGovernanceActor,
  governanceActors,
  governanceEntityId,
} from './fixtures/domains/governance';

test('an invited blogger needs blogs:view to discover and open a private blog @pr', async ({
  browser,
  e2eRun,
  seed,
}) => {
  const sql = db();
  const actors = governanceActors(e2eRun);
  const invitedReader = await authenticateGovernanceActor(browser, actors, 'collaborator');
  const blogId = governanceEntityId(e2eRun, 'private-blog');
  const ownerBloggerId = governanceEntityId(e2eRun, 'private-blog-owner');
  const readerBloggerId = governanceEntityId(e2eRun, 'private-blog-reader');
  const readerRoleId = governanceEntityId(e2eRun, 'private-blog-reader-role');
  const viewRightId = governanceEntityId(e2eRun, 'private-blog-view-right');
  const title = `${e2eRun.prefix} private blog`;

  await sql`
    insert into public.blog (id, title, visibility, created_at, updated_at)
    values (${blogId}::uuid, ${title}, 'private', now(), now());

    insert into public.role (
      id, name, scope, blog_id, assignment_mode, visibility, created_at
    ) values (
      ${readerRoleId}::uuid, ${`${e2eRun.prefix} Blog reader`}, 'blog',
      ${blogId}::uuid, 'assigned', 'public', now()
    );

    insert into public.action_right (id, resource, action, role_id, blog_id, created_at)
    values (
      ${viewRightId}::uuid, 'blogs', 'view', ${readerRoleId}::uuid, ${blogId}::uuid, now()
    );

    insert into public.blog_blogger (
      id, blog_id, user_id, role_id, status, visibility, created_at
    ) values
      (
        ${ownerBloggerId}::uuid, ${blogId}::uuid, ${seed.userId}::uuid,
        null, 'owner', 'public', now()
      ),
      (
        ${readerBloggerId}::uuid, ${blogId}::uuid, ${invitedReader.id}::uuid,
        ${readerRoleId}::uuid, 'invited', 'public', now()
      );
  `;

  const readerContext = await browser.newContext({ storageState: invitedReader.storageStatePath });
  try {
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/blog/${blogId}`);
    await waitForAppReady(readerPage);
    await expect(readerPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(readerPage.locator('[data-entity-visibility="private"]')).toHaveCount(1);

    await sql`delete from public.action_right where id = ${viewRightId}::uuid`;
    const revokedAccess = await sql`
      select
        (
          select count(*)::int
          from public.action_right
          where role_id = ${readerRoleId}::uuid
            and blog_id = ${blogId}::uuid
            and resource = 'blogs'
            and public.permission_action_implies_view(action)
        ) as view_right_count,
        exists (
          select 1
          from public.search_document_blog_discovery_acl_users(${blogId}::uuid)
          where user_id = ${invitedReader.id}::uuid
        ) as can_discover
    `;
    expect(revokedAccess[0]).toMatchObject({ view_right_count: 0, can_discover: false });
  } finally {
    await readerContext.close();
    await removeActorAuthState(invitedReader);
  }
});
