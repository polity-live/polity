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
    const sql = db();
    const peer = e2eRun.actor('studio-peer');
    await authenticateActor(browser, peer);
    const peerContext = await browser.newContext({ storageState: peer.storageStatePath });
    const peerPage = await peerContext.newPage();
    const route = scope === 'group' ? `/group/${seed.groupId}/studio` : '/studio';
    let projectId: string | undefined;
    try {
      await page.goto(route);
      await waitForAppReady(page);
      await page
        .getByRole('textbox', { name: 'Title', exact: true })
        .fill(`${e2eRun.prefix} Studio`);
      const created = page.waitForResponse(
        response =>
          response.url().endsWith('/api/studio') &&
          response.request().postDataJSON()?.operation === 'create'
      );
      await page.getByRole('button', { name: 'Create project', exact: true }).click();
      const response = await created;
      expect(response.ok()).toBe(true);
      projectId = (await response.json()).id;
      expect(projectId).toEqual(expect.any(String));
      const projectRoute = `${route}?project=${projectId}`;
      await expect(page).toHaveURL(new RegExp(`project=${projectId}`));
      const title = page.locator('header').getByRole('textbox', { name: 'Title', exact: true });
      await expect(title).toBeEnabled();
      await title.fill('Persisted studio title');
      await expect
        .poll(async () => {
          const [state] =
            await sql`select document->>'title' as title from studio_state where project_id=${projectId}::uuid`;
          return state?.title;
        })
        .toBe('Persisted studio title');
      await page.reload();
      await expect(title).toHaveValue('Persisted studio title');
      await expect(title).toBeEnabled();

      if (scope === 'personal') {
        const denied = peerPage.waitForResponse(
          response =>
            response.url().endsWith('/api/collaboration') &&
            response.request().postDataJSON()?.operation === 'session'
        );
        await peerPage.goto(projectRoute);
        expect((await denied).status()).toBe(403);
        await expect(peerPage.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);

        await context.setOffline(true);
        await expect(
          page.getByText('Offline — changes are only saved locally', { exact: true })
        ).toBeVisible();
        await title.fill('Retained through reconnect');
        await context.setOffline(false);
        await expect
          .poll(async () => {
            const [state] =
              await sql`select document->>'title' as title from studio_state where project_id=${projectId}::uuid`;
            return state?.title;
          })
          .toBe('Retained through reconnect');
        await page.reload();
        await expect(title).toHaveValue('Retained through reconnect');
      } else {
        await sql`insert into group_membership(id,group_id,user_id,status) values(${crypto.randomUUID()},${seed.groupId},${peer.id},'member')`;
        await peerPage.goto(projectRoute);
        const peerTitle = peerPage
          .locator('header')
          .getByRole('textbox', { name: 'Title', exact: true });
        await expect(peerTitle).toHaveValue('Persisted studio title');
        await expect(peerTitle).toBeDisabled();
        await sql`update group_membership set status='admin' where group_id=${seed.groupId} and user_id=${peer.id}`;
        await peerPage.reload();
        await expect(peerTitle).toBeEnabled();
        // Permission changes fence existing document generations. Reconnect
        // explicitly so the owner also joins the newly authorized session.
        await page
          .locator(
            '[data-action-id="collaboration.collaboration-status.features-collaboration-reconnect"]'
          )
          .click();
        await expect(title).toBeEnabled();
        await peerTitle.fill('Shared group edit');
        await expect(title).toHaveValue('Shared group edit');
        await page.reload();
        await expect(title).toHaveValue('Shared group edit');
      }
    } finally {
      await context.setOffline(false);
      await peerContext.close();
      await removeActorAuthState(peer);
      if (projectId) {
        // Only this test's project/history is removed. The transaction-local
        // replication mode permits teardown of immutable evidence on the test DB.
        await sql.begin(async tx => {
          await tx`set local session_replication_role = replica`;
          await tx`delete from studio_revision where project_id=${projectId}`;
          await tx`delete from studio_state where project_id=${projectId}`;
          await tx`delete from collaboration_command where document_id in (select id from collaboration_document where kind='studio' and entity_id=${projectId})`;
          await tx`delete from collaboration_outbox where document_id in (select id from collaboration_document where kind='studio' and entity_id=${projectId})`;
          await tx`delete from collaboration_revision where document_id in (select id from collaboration_document where kind='studio' and entity_id=${projectId})`;
          await tx`delete from collaboration_document where kind='studio' and entity_id=${projectId}`;
          await tx`delete from studio_project where id=${projectId}`;
        });
      }
    }
  });
}
