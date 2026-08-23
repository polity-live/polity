import { expect, test } from './fixtures/test';
import { removeActorAuthState } from './fixtures/auth';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import {
  authenticateGovernanceActor,
  governanceActors,
  governanceEntityId,
} from './fixtures/domains/governance';

test('only an invited blogger with blogs:view opens a private blog @pr', async ({
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
    await readerPage.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(readerPage).toHaveURL(/\/home$/);
    await waitForAppReady(readerPage);
    await readerPage.goBack();
    await waitForAppReady(readerPage);
    await expect(
      readerPage.getByRole('heading', { name: /This Page Is Private|Diese Seite ist privat/i })
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await readerContext.close();
    await removeActorAuthState(invitedReader);
  }
});
