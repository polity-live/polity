import { createClient } from '@supabase/supabase-js';
import { test, expect } from './fixtures/test';
import { db } from './fixtures/db';
import { waitForAppReady } from './fixtures/readiness';

// Provider fixtures must reach Playwright rather than the PWA service worker.
test.use({ serviceWorkers: 'block' });

test('keeps Studio interactive while project chat receives messages and awaits AI @pr @resilience', async ({
  page,
  baseURL,
  e2eUser,
  e2eRun,
}) => {
  const origin = new URL(baseURL ?? 'http://localhost:3000');
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
  if (
    !['localhost', '127.0.0.1'].includes(origin.hostname) ||
    !['localhost', '127.0.0.1'].includes(new URL(supabaseUrl).hostname)
  ) {
    throw new Error('Studio chat regression requires the local test stack');
  }
  const auth = createClient(
    supabaseUrl,
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await auth.auth.signInWithPassword({
    email: e2eUser.email,
    password: e2eUser.password,
  });
  if (error) throw error;
  const response = await page.request.post('/api/studio', {
    headers: { Authorization: `Bearer ${data.session!.access_token}` },
    data: {
      operation: 'create',
      groupId: null,
      title: `${e2eRun.prefix} Chat regression`,
      kind: 'single',
      themeId: '00000000-0000-4000-8000-000000000001',
      themeMode: 'light',
      template: { kind: 'builtin', id: 'announcement' },
    },
  });
  expect(response.ok()).toBe(true);
  const { id: projectId } = (await response.json()) as { id: string };
  e2eRun.registerEntityId(projectId);
  const sql = db();
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  let releaseReply: (() => void) | undefined;
  let requestReceived: Promise<void>;
  let notifyReceived: () => void;
  let conversationId: string | undefined;

  await page.route('**/api/ai/catalog', route =>
    route.fulfill({
      json: {
        models: [
          {
            provider: 'openrouter',
            id: 'openrouter/free',
            label: 'Local test model',
            source: 'app',
            free: true,
            supports_tools: true,
            supports_reasoning_effort: false,
            context_window: 200_000,
          },
        ],
      },
    })
  );
  await page.route('**/api/ai/chat', async route => {
    const body = route.request().postDataJSON();
    conversationId = body.conversationId;
    const reply = new Promise<void>(resolve => {
      releaseReply = resolve;
    });
    // Real replicated messages reproduce the participant update feedback;
    // the AI HTTP response is replaced with a deterministic reply.
    await sql`
      insert into message (id, conversation_id, sender_id, content)
      values (${crypto.randomUUID()}, ${body.conversationId}, ${e2eUser.id}, ${body.content})
    `;
    notifyReceived();
    await reply;
    await route.fulfill({
      contentType: 'application/x-ndjson',
      body: JSON.stringify({ type: 'text-delta', text: 'Local test response.' }) + '\n',
    });
  });

  try {
    await page.goto(`/studio/${projectId}`);
    await waitForAppReady(page);
    const title = page.locator('header').getByRole('textbox', { name: 'Title', exact: true });
    await expect(title).toBeEnabled();
    const openChat = page.locator('[data-action-id="project-chat.dock.open"]');
    await openChat.click();
    const prompt = page.locator('[data-action-id="messages.assistant.prompt.change"]');
    const send = page.locator('[data-action-id="messages.assistant.send"]');
    const minimize = page.locator('[data-action-id="project-chat.dock.minimize"]');

    for (let round = 1; round <= 2; round++) {
      requestReceived = new Promise<void>(resolve => {
        notifyReceived = resolve;
      });
      await prompt.fill(`Local responsiveness check ${round}`);
      await expect(send).toBeEnabled();
      await send.click();
      await requestReceived;
      await expect(page.getByText(/is thinking/)).toBeVisible();
      await expect(
        page.getByText(`Local responsiveness check ${round}`, { exact: true })
      ).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(
          async () => {
            const [participant] = await sql`
            select last_read_at >= (select max(created_at) from message where conversation_id=${conversationId}) as read
            from conversation_participant where conversation_id=${conversationId} and user_id=${e2eUser.id}
          `;
            return participant?.read;
          },
          { timeout: 30_000 }
        )
        .toBe(true);
      const [initialRead] = await sql`
        select last_read_at::text as value from conversation_participant
        where conversation_id=${conversationId} and user_id=${e2eUser.id}
      `;

      await minimize.click({ timeout: 10_000 });
      await page.getByRole('button', { name: 'Layers', exact: true }).click({ timeout: 10_000 });
      await title.fill(`${e2eRun.prefix} Responsive ${round}`, { timeout: 10_000 });
      await expect(title).toHaveValue(`${e2eRun.prefix} Responsive ${round}`);
      await page.mouse.wheel(0, 250);
      await openChat.click({ timeout: 10_000 });
      await prompt.fill('Typing still works while awaiting AI', { timeout: 10_000 });
      await expect(prompt).toHaveValue('Typing still works while awaiting AI');
      const [currentRead] = await sql`
        select last_read_at::text as value from conversation_participant
        where conversation_id=${conversationId} and user_id=${e2eUser.id}
      `;
      expect(currentRead.value).toBe(initialRead.value);
      releaseReply!();
      await expect(send).toHaveAttribute('aria-label', 'Send');
      await expect(page.getByText('Local test response.')).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: 'output/playwright/studio-chat-freeze-fixed.png' });
  } catch (error) {
    await page.screenshot({ path: 'output/playwright/studio-chat-before-cleanup.png' });
    throw error;
  } finally {
    releaseReply?.();
    await page.unrouteAll({ behavior: 'wait' });
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await sql`delete from studio_project where id=${projectId}`;
  }
});
