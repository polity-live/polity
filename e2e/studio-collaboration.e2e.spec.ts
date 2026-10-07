import { expect, test } from './fixtures/test';
import { authenticateActor, removeActorAuthState } from './fixtures/auth';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';

for (const scope of ['personal', 'group'] as const) {
  test(`persists ${scope} Studio edits across reload, peers and reconnect @pr @nightly`, async ({
    browser,
    context,
    page,
    seed,
    e2eRun,
  }) => {
    test.setTimeout(300_000);
    const sql = db();
    const peer = e2eRun.actor('studio-peer');
    await authenticateActor(browser, peer);
    const peerContext = await browser.newContext({ storageState: peer.storageStatePath });
    const peerPage = await peerContext.newPage();
    const route = scope === 'group' ? `/group/${seed.groupId}/studio` : '/studio';
    const obsoleteRequests: string[] = [];
    for (const target of [page, peerPage])
      target.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path === '/api/studio' || path.startsWith('/api/studio/read/'))
          obsoleteRequests.push(path);
      });
    let projectId: string | undefined;
    try {
      await page.goto(route);
      await waitForAppReady(page);
      await page.getByRole('link', { name: 'Create project', exact: true }).click();
      await page
        .locator('[data-create-action="set-form-style"][data-create-option="one_page"]')
        .click();
      await page
        .getByRole('textbox', { name: /^Title(?:\s*\*)?$/ })
        .fill(`${e2eRun.prefix} Studio`);
      await page.locator('[data-create-action="submit"]').click();
      await expect(page).toHaveURL(/\/studio\/[a-f0-9-]{36}\/?$/, { timeout: 60_000 });
      projectId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!;
      e2eRun.registerEntityId(projectId);
      expect((await sql`select title from studio_project where id=${projectId}`)[0].title).toBe(
        `${e2eRun.prefix} Studio`
      );
      const projectRoute = `${route}/${projectId}`;
      await expect(page).toHaveURL(new RegExp(`${route}/${projectId}/?$`));
      const title = page.locator('header').getByRole('textbox', { name: 'Title', exact: true });
      await expect(title).toBeEnabled();
      await title.fill('Persisted studio title');
      await expect
        .poll(
          async () => {
            const [state] =
              await sql`select document->>'title' as title from studio_state where project_id=${projectId}::uuid`;
            return state?.title;
          },
          { timeout: 30_000 }
        )
        .toBe('Persisted studio title');
      await page.reload();
      await waitForAppReady(page);
      await expect(title).toHaveValue('Persisted studio title');
      await expect(title).toBeEnabled();

      if (scope === 'personal') {
        await peerPage.goto(projectRoute);
        await waitForAppReady(peerPage);
        await expect(peerPage.getByRole('alert')).toHaveText(
          'This Studio project is unavailable.',
          {
            timeout: 30_000,
          }
        );
        await expect(peerPage.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);

        await context.setOffline(true);
        await expect(
          page.getByRole('alert').filter({
            hasText: 'You are offline. Your current work stays open while Polity reconnects.',
          })
        ).toBeVisible();
        await title.fill('Retained through reconnect');
        await expect(title).toHaveValue('Retained through reconnect');
        const [offlineState] =
          await sql`select document->>'title' as title from studio_state where project_id=${projectId}::uuid`;
        expect(offlineState?.title).toBe('Persisted studio title');
        await context.setOffline(false);
        await expect
          .poll(
            async () => {
              const [state] =
                await sql`select document->>'title' as title from studio_state where project_id=${projectId}::uuid`;
              return state?.title;
            },
            { timeout: 30_000 }
          )
          .toBe('Retained through reconnect');
        await page.reload();
        await waitForAppReady(page);
        await expect(title).toHaveValue('Retained through reconnect');
      } else {
        const membershipId = crypto.randomUUID();
        const roleId = crypto.randomUUID();
        e2eRun.registerEntityId(membershipId);
        e2eRun.registerEntityId(roleId);
        await sql.begin(async tx => {
          await tx`insert into group_membership(id,group_id,user_id,status) values(${membershipId},${seed.groupId},${peer.id},'member')`;
          await tx`insert into role(id,name,scope,group_id) values(${roleId},${`${e2eRun.prefix} Studio reader`},'group',${seed.groupId})`;
          await tx`insert into group_membership_role(group_membership_id,role_id) values(${membershipId},${roleId})`;
          await tx`insert into action_right(resource,action,role_id,group_id) values('projects','view',${roleId},${seed.groupId})`;
        });
        await peerPage.goto(projectRoute);
        await waitForAppReady(peerPage);
        await expect(
          peerPage.getByText('You can view this project.', { exact: true })
        ).toBeVisible();
        await expect(peerPage.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
        const peerTitle = peerPage
          .locator('header')
          .getByRole('textbox', { name: 'Title', exact: true });
        await sql`update action_right set action='manage' where role_id=${roleId} and resource='projects'`;
        await peerPage.reload();
        await waitForAppReady(peerPage);
        await expect(peerTitle).toBeEnabled();
        // Reload joins the generation created by the permission change.
        await page.reload();
        await waitForAppReady(page);
        await expect(title).toBeEnabled();
        await peerTitle.fill('Shared group edit');
        await expect(title).toHaveValue('Shared group edit', { timeout: 30_000 });
        await page.reload();
        await waitForAppReady(page);
        await expect(title).toHaveValue('Shared group edit');
      }
      expect(obsoleteRequests).toEqual([]);
    } finally {
      await context.setOffline(false).catch(() => undefined);
      await peerContext.close();
      await removeActorAuthState(peer);
      if (!projectId) {
        const [created] =
          await sql`select id from studio_project where owner_id=${seed.userId} and title=${`${e2eRun.prefix} Studio`}`;
        projectId = created?.id as string | undefined;
      }
      if (projectId) {
        // Only this test's project/history is removed. The transaction-local
        // replication mode permits teardown of immutable evidence on the test DB.
        await sql.begin(async tx => {
          await tx`set local session_replication_role = replica`;
          await tx`delete from studio_revision where project_id=${projectId}`;
          await tx`delete from studio_state where project_id=${projectId}`;
          await tx`delete from studio_operation where project_id=${projectId}`;
          await tx`delete from studio_editor_action where project_id=${projectId}`;
          await tx`delete from studio_project where id=${projectId}`;
        });
      }
    }
  });
}
