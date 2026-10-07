import { createStudioProject } from './fixtures/studio';
import { test, expect } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';
import { executeZeroTransaction, createZeroContext } from '../src/server/zero-mutate';
import { executeProjectTool } from '../src/server/project-chat/tools';
import { executeStudioChatSuggestion } from '../src/server/project-chat/studio-suggestions';

// Provider fixtures must reach Playwright rather than the PWA service worker.
test.use({ serviceWorkers: 'block' });

test('shows Studio context and changes the subtitle through a reviewed suggestion @pr', async ({
  page,
  baseURL,
  e2eUser,
  e2eRun,
}) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(30000);
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL!).hostname))
    throw new Error('Local Studio context acceptance only');
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(supabaseUrl).hostname))
    throw new Error('Local Supabase only');
  const projectId = await createStudioProject(page, `${e2eRun.prefix} Context`);
  e2eRun.registerEntityId(projectId);
  const sql = db();
  const [initial] = await sql`select document from studio_state where project_id=${projectId}`;
  const title = initial.document.nodes.find(
    (node: { type: string; name: string; textRole?: string }) =>
      node.type === 'richText' &&
      (node.textRole === 'title' || node.name === initial.document.title)
  );
  const subtitle = initial.document.nodes.find(
    (node: { name: string; textRole?: string }) =>
      node.textRole === 'subtitle' || node.name === 'Euren Inhalt hier ergänzen.'
  );
  if (!title || !subtitle) {
    await sql`delete from studio_project where id=${projectId}`;
    throw new Error('Expected standard text roles');
  }
  let suggestionId: string | undefined;
  let payload: any;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/ai/catalog', route =>
    route.fulfill({
      json: {
        models: [
          {
            provider: 'openrouter',
            id: 'openrouter/free',
            label: 'Local model fixture',
            source: 'app',
            free: true,
            supports_tools: true,
            context_window: 200000,
          },
        ],
      },
    })
  );
  // Replace only the provider decision. Run the actual read, validation, proposal
  // persistence and later acceptance paths against the isolated local fixture.
  await page.route('**/api/ai/chat', async route => {
    payload = route.request().postDataJSON();
    const runId = crypto.randomUUID();
    await sql`insert into ai_run(id,conversation_id,actor_id,request_id,status,model,request_hash,lease_token,lease_expires_at,created_at,updated_at)
      values(${runId},${payload.conversationId},${e2eUser.id},${payload.requestId},'running','{}','test',${crypto.randomUUID()},${Date.now() + 120000},${Date.now()},${Date.now()})`;
    const read = (await executeZeroTransaction(createZeroContext(e2eUser.id), tx =>
      executeProjectTool(
        tx,
        e2eUser.id,
        runId,
        payload.conversationId,
        crypto.randomUUID(),
        'studio_read',
        {},
        payload.editorContext
      )
    )) as { snapshotId: string };
    const suggestion = await executeStudioChatSuggestion(
      e2eUser.id,
      projectId,
      runId,
      'studio_edit_suggestion',
      {
        snapshotId: read.snapshotId,
        summary: 'Subtitle to test',
        sourceWorkspaceId: '00000000-0000-0000-0000-000000000000',
        edits: [{ role: 'subtitle', text: 'test' }],
      },
      payload.content,
      payload.editorContext,
      { requestKey: `${runId}:subtitle` }
    );
    suggestionId = suggestion.proposalId;
    await sql`insert into message(id,conversation_id,sender_id,content,context_json,created_at,updated_at) values(${payload.requestId},${payload.conversationId},${e2eUser.id},${payload.content},${JSON.stringify({ project: { editorContext: payload.editorContext } })},${Date.now()},${Date.now()})`;
    await sql`insert into message(id,conversation_id,sender_id,content,context_json,created_at,updated_at) values(${runId},${payload.conversationId},'a12a0000-0000-4000-a000-000000000001','Subtitle suggestion ready.',${JSON.stringify({ project: { editorContext: payload.editorContext, outcome: 'proposed' } })},${Date.now() + 1},${Date.now() + 1})`;
    await sql`update ai_run set status='completed' where id=${runId}`;
    await route.fulfill({
      contentType: 'application/x-ndjson',
      body: JSON.stringify({ type: 'text-delta', text: 'Subtitle suggestion ready.' }) + '\n',
    });
  });
  try {
    await page.goto(`/studio/${projectId}`);
    await waitForAppReady(page);
    await page.getByRole('button', { name: /Layers|Ebenen/i, exact: true }).click();
    await page
      .locator(`[data-studio-layer-id="${title.id}"]`)
      .getByRole('button', { name: title.name, exact: true })
      .click();
    await page.locator('[data-action-id="project-chat.dock.open"]').click();
    const context = page
      .getByLabel(/Project context|Projektkontext/)
      .filter({ hasText: `Element · ${title.name}` });
    await expect(context).toContainText(/This project|Dieses Projekt/);
    await expect(context).toContainText(`Element · ${title.name}`);
    const prompt = page.locator('[data-action-id="messages.assistant.prompt.change"]');
    await prompt.fill('@frame@');
    await expect(
      page.locator('[data-action-id="messages.assistant.suggestion.attachment.select"]')
    ).toBeVisible();
    await prompt.fill('Ändere den subtitle des frames in "test"');
    await page.locator('[data-action-id="messages.assistant.send"]').click();
    await expect(
      page.getByText(/Suggestion created|Vorschlag erstellt/, { exact: true })
    ).toBeVisible({ timeout: 60000 });
    expect(payload.editorContext.elementIds).toContain(title.id);
    expect(payload.toolNames).toEqual([]);
    const [proposal] = await sql`select document from canvas_proposal where id=${suggestionId!}`;
    expect(
      proposal.document.nodes.find((node: { id: string }) => node.id === subtitle.id).content[0]
        .children[0].text
    ).toBe('test');
    expect(proposal.document.nodes.find((node: { id: string }) => node.id === title.id)).toEqual(
      title
    );
    await page.locator('[data-action-id="project-chat.dock.minimize"]').click();
    await page
      .locator(`[data-testid="studio-change-outline-${suggestionId}:${subtitle.id}"]`)
      .getByRole('button')
      .click();
    await page.getByRole('button', { name: /Accept|Annehmen/, exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await sql`select document from studio_state where project_id=${projectId}`
          )[0].document.nodes.find((node: { id: string }) => node.id === subtitle.id).content[0]
            .children[0].text
      )
      .toBe('test');
    expect(errors).toEqual([]);
  } finally {
    try {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: 'wait' });
        await page.goto('/home', { waitUntil: 'domcontentloaded' });
      }
    } finally {
      await sql`delete from canvas_receipt where project_id=${projectId}`;
      await sql`delete from canvas_proposal where project_id=${projectId} and owner_id=${e2eUser.id}`;
      await sql`delete from studio_project where id=${projectId} and owner_id=${e2eUser.id}`;
    }
  }
});
