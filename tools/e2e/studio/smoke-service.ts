// Local Studio smoke: real Zero clients, database operations and optional OpenRouter calls.
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { Zero } from '@rocicorp/zero';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, type ToolSet } from 'ai';
import assert from 'node:assert/strict';
import { schema } from '../../../src/zero/schema';
import { mutators } from '../../../src/zero/mutators';
import { queries } from '../../../src/zero/queries';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { diffStudio } from '../../../src/features/communication-studio/logic/operations';
import {
  legacyDocumentToV3,
  v3DocumentToLegacy,
} from '../../../src/features/communication-studio/logic/v3-adapter';
import { studioDocumentV3Schema } from '../../../src/features/communication-studio/logic/document-v3';
import { serverConfirmed } from '../../../src/zero/mutate-with-server-check';
for (const path of ['.env', '.env.development.local']) config({ path, quiet: true });
const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
);
for (const url of [local.DB_URL, local.API_URL])
  assert(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Local stack required');
process.env.ZERO_UPSTREAM_DB = local.DB_URL;
process.env.STUDIO_DATABASE_URL = local.DB_URL;
process.env.SUPABASE_URL = local.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY;
const { createZeroContext, executeZeroTransaction } =
  await import('../../../src/server/zero-mutate');
const { projectChatSharedMutators } =
  await import('../../../src/zero/project-chat/shared-mutators');
const { toolsForScope, executeProjectTool } =
  await import('../../../src/server/project-chat/tools');
const { applyStudioOperation } = await import('../../../src/server/studio/operations');
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const email = `studio-smoke-${crypto.randomUUID()}@example.test`,
  password = crypto.randomUUID() + 'aA1!';
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw created.error;
const actor = created.data.user.id,
  projectId = crypto.randomUUID(),
  conversationId = crypto.randomUUID(),
  ctx = createZeroContext(actor);
const session = await admin.auth.signInWithPassword({ email, password });
if (session.error) throw session.error;
const groupId = process.argv.includes('--group') ? crypto.randomUUID() : null;
let member: { id: string; email: string; token: string } | null = null;
if (groupId) {
  const email = `studio-member-${crypto.randomUUID()}@example.test`,
    password = crypto.randomUUID() + 'Aa1!';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const auth = await admin.auth.signInWithPassword({ email, password });
  if (auth.error) throw auth.error;
  member = { id: created.data.user.id, email, token: auth.data.session.access_token };
}
const value = createDocument('single', 'Studio smoke'),
  page = value.pages[0];
page.elements = page.elements.filter(e => e.type === 'text').slice(0, 1);
page.elements[0].text = 'Smoke heading';
const persistedValue = legacyDocumentToV3(value);
const clients: Zero<typeof schema>[] = [];
const report: { checks: unknown[]; models: unknown[] } = { checks: [], models: [] };
const wait = async (fn: () => Promise<boolean>, message: string) => {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(message);
};
try {
  await executeZeroTransaction(ctx, async tx => {
    await tx.dbTransaction.query('insert into "user"(id) values($1) on conflict do nothing', [
      actor,
    ]);
    await tx.dbTransaction.query(
      'insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values($1,$2,$3,$4,5,0,0)',
      [projectId, actor, value.title, value.kind]
    );
    await tx.dbTransaction.query(
      'insert into studio_state(project_id,document,updated_at) values($1,$2::jsonb,0)',
      [projectId, persistedValue]
    );
    if (groupId && member) {
      await tx.dbTransaction.query('insert into "group"(id,name,owner_id) values($1,$2,$3)', [
        groupId,
        'Studio smoke group',
        actor,
      ]);
      await tx.dbTransaction.query(
        "insert into group_membership(group_id,user_id,status) values($1,$2,'admin')",
        [groupId, member.id]
      );
      await tx.dbTransaction.query('update studio_project set group_id=$2 where id=$1', [
        projectId,
        groupId,
      ]);
    }
    await projectChatSharedMutators.create.fn({
      tx,
      ctx,
      args: { id: conversationId, scope: { kind: 'studio', projectId }, name: 'Smoke' },
    });
  });
  for (let i = 0; i < 2; i++)
    clients.push(
      new Zero({
        schema,
        mutators,
        userID: i === 1 && member ? member.id : actor,
        auth: i === 1 && member ? member.token : session.data.session.access_token,
        context: {
          userID: i === 1 && member ? member.id : actor,
          email: i === 1 && member ? member.email : email,
        },
        cacheURL: 'http://localhost:4848',
        queryURL: 'http://host.docker.internal:3000/api/query',
        mutateURL: 'http://host.docker.internal:3000/api/mutate',
        kvStore: 'mem',
      })
    );
  const query = queries.studio.document({ id: projectId });
  await Promise.all(clients.map(c => c.run(query, { type: 'complete' })));
  const next = structuredClone(value);
  next.title = 'Zero smoke confirmed';
  await serverConfirmed(
    clients[0].mutate(
      mutators.studio.apply({
        projectId,
        operationId: crypto.randomUUID(),
        changes: diffStudio(value, next),
      })
    )
  );
  await wait(
    async () => (await clients[1].run(query))?.document.title === next.title,
    'Second Zero client did not receive update'
  );
  report.checks.push({ name: 'zero-two-clients', status: 'passed' });
  // Conflict and idempotency exercise the same server mutation as the client.
  await executeZeroTransaction(ctx, async tx => {
    const operationId = crypto.randomUUID(),
      changes = diffStudio(next, { ...next, title: 'A' }),
      args = { projectId, operationId, changes };
    const first = await applyStudioOperation(tx, actor, args);
    assert.equal(first.status, 'applied');
    assert.deepEqual(await applyStudioOperation(tx, actor, args), first);
    const conflict = await applyStudioOperation(tx, actor, {
      projectId,
      operationId: crypto.randomUUID(),
      changes: diffStudio(next, { ...next, title: 'B' }),
    });
    assert.equal(conflict.status, 'conflict');
  });
  report.checks.push({ name: 'conflict-and-idempotency', status: 'passed' });
  if (process.argv.includes('--presence')) {
    const realtimeClients = [
      session.data.session.access_token,
      member?.token ?? session.data.session.access_token,
    ].map(token =>
      createClient(local.API_URL, local.ANON_KEY, {
        auth: { persistSession: false },
        accessToken: async () => token,
      })
    );
    await Promise.all(
      realtimeClients.map((client, i) =>
        client.realtime.setAuth(
          i === 0
            ? session.data.session.access_token
            : (member?.token ?? session.data.session.access_token)
        )
      )
    );
    const channels = realtimeClients.map((client, i) =>
      client.channel(`studio:${projectId}`, {
        config: { private: true, presence: { key: `client-${i}` } },
      })
    );
    channels.forEach(c =>
      c.on('presence', { event: 'sync' }, () => {
        /* Subscribe to Presence events before inspecting channel state. */
      })
    );
    try {
      await Promise.all(
        channels.map(
          c =>
            new Promise<void>((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error('Presence subscribe timeout')),
                15000
              );
              c.subscribe(status => {
                if (status === 'SUBSCRIBED') {
                  clearTimeout(timer);
                  resolve();
                } else if (status === 'CHANNEL_ERROR') {
                  clearTimeout(timer);
                  reject(new Error('Private Presence rejected'));
                }
              });
            })
        )
      );
      await channels[0].track({ userId: actor });
      await channels[1].track({ userId: member?.id ?? actor });
      await wait(
        async () => Object.keys(channels[0].presenceState()).length === 2,
        'Presence did not reach both clients'
      );
      let cursor: unknown = null;
      channels[1].on('broadcast', { event: 'cursor' }, ({ payload }) => {
        cursor = payload;
      });
      await channels[0].send({
        type: 'broadcast',
        event: 'cursor',
        payload: { pageId: page.id, x: 100, y: 200 },
      });
      await wait(async () => !!cursor, 'Presence cursor missing');
      assert.deepEqual(cursor, { pageId: page.id, x: 100, y: 200 });
      report.checks.push({ name: 'private-presence-and-cursor', status: 'passed' });
    } finally {
      await Promise.all(realtimeClients.map(c => c.removeAllChannels()));
    }
  }

  if (groupId && member) {
    const base = (await clients[0].run(query, { type: 'complete' }))?.document;
    if (!base) throw new Error('Studio missing');
    const legacyBase = v3DocumentToLegacy(studioDocumentV3Schema.parse(base));
    const a = structuredClone(legacyBase),
      b = structuredClone(legacyBase);
    a.pages[0].background = '#AABBCC';
    b.pages[0].elements[0].x = 222;
    await serverConfirmed(
      clients[0].mutate(
        mutators.studio.apply({
          projectId,
          operationId: crypto.randomUUID(),
          changes: diffStudio(base, legacyDocumentToV3(a, studioDocumentV3Schema.parse(base))),
        })
      )
    );
    await serverConfirmed(
      clients[1].mutate(
        mutators.studio.apply({
          projectId,
          operationId: crypto.randomUUID(),
          changes: diffStudio(base, legacyDocumentToV3(b, studioDocumentV3Schema.parse(base))),
        })
      )
    );
    await wait(async () => {
      const raw = (await clients[0].run(query))?.document;
      if (!raw) return false;
      const d = v3DocumentToLegacy(studioDocumentV3Schema.parse(raw));
      return d.pages[0].background === '#AABBCC' && d.pages[0].elements[0].x === 222;
    }, 'Independent group changes did not merge');
    report.checks.push({ name: 'group-independent-authors', status: 'passed' });
    await executeZeroTransaction(ctx, tx =>
      tx.dbTransaction.query(
        "update group_membership set status='invited' where group_id=$1 and user_id=$2",
        [groupId, member?.id]
      )
    );
    await wait(async () => !(await clients[1].run(query)), 'Revoked member can still read');
    await assert.rejects(() =>
      serverConfirmed(
        clients[1].mutate(
          mutators.studio.apply({
            projectId,
            operationId: crypto.randomUUID(),
            changes: diffStudio(base, { ...base, title: 'Denied' }),
          })
        )
      )
    );
    report.checks.push({ name: 'group-revocation-read-and-write', status: 'passed' });
  }
  if (process.argv.includes('--live-ai')) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      report.models.push({ status: 'blocked', reason: 'OPENROUTER_API_KEY missing' });
      process.exitCode = 2;
    } else {
      const catalog = (await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      }).then(r => r.json())) as {
        data: {
          id: string;
          pricing: { prompt: string; completion: string };
          supported_parameters?: string[];
        }[];
      };
      const free = catalog.data.filter(
        m =>
          Number(m.pricing.prompt) === 0 &&
          Number(m.pricing.completion) === 0 &&
          m.id !== 'openrouter/free' &&
          m.supported_parameters?.includes('tools')
      );
      const preferred = ['cohere/north-mini-code:free', 'qwen/qwen3.8-27b:free'];
      free.sort(
        (a, b) =>
          (preferred.includes(a.id) ? -1 : 0) - (preferred.includes(b.id) ? -1 : 0) ||
          a.id.localeCompare(b.id)
      );
      const models = [...free.slice(0, 2).map(m => m.id), 'openrouter/free'];
      for (const modelId of models) {
        const runId = crypto.randomUUID(),
          started = Date.now(),
          calls: unknown[] = [];
        try {
          await executeZeroTransaction(ctx, async tx => {
            const rows = await tx.dbTransaction.query(
              'select document from studio_state where project_id=$1',
              [projectId]
            );
            const before = studioDocumentV3Schema.parse(
              (rows as { document: unknown }[])[0].document
            );
            const reset = structuredClone(value);
            reset.pages[0].elements[0].bold = false;
            reset.pages[0].elements[0].align = 'left';
            const changes = diffStudio(before, legacyDocumentToV3(reset, before));
            if (changes.length)
              await applyStudioOperation(tx, actor, {
                projectId,
                operationId: crypto.randomUUID(),
                changes,
              });
          });
          await wait(async () => {
            const d = await clients[1].run(query);
            if (!d?.document) return false;
            const legacy = v3DocumentToLegacy(studioDocumentV3Schema.parse(d.document));
            return (
              legacy.pages[0].elements.length === 1 && legacy.pages[0].elements[0].bold === false
            );
          }, 'Reset did not reach second client');
          await executeZeroTransaction(ctx, async tx => {
            await tx.dbTransaction.query(
              "insert into ai_run(id,conversation_id,actor_id,request_id,status,model,request_hash,lease_token,lease_expires_at,created_at,updated_at) values($1,$2,$3,$4,'running','{}','smoke',$5,$6,0,0)",
              [
                runId,
                conversationId,
                actor,
                crypto.randomUUID(),
                crypto.randomUUID(),
                Date.now() + 240000,
              ]
            );
          });
          const definitions = toolsForScope(true),
            names = [
              'studio_read',
              'studio_format_text',
              'studio_insert_shape',
              'studio_align_elements',
            ];
          const tools: ToolSet = Object.fromEntries(
            names.map(name => [
              name,
              {
                ...definitions[name],
                execute: async (input: unknown, options: { toolCallId: string }) => {
                  const output = await executeZeroTransaction(ctx, tx =>
                    executeProjectTool(
                      tx,
                      actor,
                      runId,
                      conversationId,
                      options.toolCallId,
                      name,
                      input
                    )
                  );
                  calls.push({ name, input, output });
                  return output;
                },
              },
            ])
          );
          const beforeAi = (await clients[1].run(query))?.document;
          const existingIds = new Set(
            beforeAi
              ? v3DocumentToLegacy(studioDocumentV3Schema.parse(beforeAi)).pages[0].elements.map(
                  element => element.id
                )
              : []
          );
          const result = await generateText({
            model: createOpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1' }).chat(
              modelId
            ),
            tools,
            stopWhen: stepCountIs(10),
            maxOutputTokens: 2200,
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(180000),
            onStepFinish: step => {
              for (const item of step.content)
                if (item.type === 'tool-error')
                  calls.push({
                    type: 'tool-error',
                    toolName: item.toolName,
                    error: String(item.error),
                  });
            },
            prompt: `Use tools to edit this Studio project. First read it. Set the heading text element bold and center-aligned. Add one rectangle to the first page, width 100 height 100. Center that rectangle horizontally on the page. Read again to verify. Read before each write for a fresh snapshot. Use this sequence: studio_read, studio_format_text, studio_read, studio_insert_shape, studio_read, studio_align_elements, studio_read. Use the exact inserted element UUID returned by createdRefs or the new read; never invent IDs. Do not stop until the rectangle is centered. Do not just describe the changes.`,
          });
          const last = await clients[1].run(query, { type: 'complete' });
          await wait(async () => {
            const current = await clients[1].run(query);
            const p = current?.document
                ? v3DocumentToLegacy(studioDocumentV3Schema.parse(current.document)).pages[0]
                : undefined,
              e = p?.elements.find(e => e.type === 'rect' && !existingIds.has(e.id));
            return (
              !!p?.elements.find(e => e.type === 'text' && e.bold && e.align === 'center') &&
              e?.x === 490
            );
          }, 'AI state was not observed on second client');
          assert(calls.length >= 4);
          report.models.push({
            modelId,
            routedModel: result.response.modelId,
            status: 'passed',
            ms: Date.now() - started,
            toolCalls: calls,
            revision: last?.content_revision,
          });
        } catch (error) {
          report.models.push({
            modelId,
            status: calls.length === 0 ? 'blocked' : 'failed',
            ms: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
            toolCalls: calls,
          });
          process.exitCode = 1;
        } finally {
          await executeZeroTransaction(ctx, tx =>
            tx.dbTransaction.query("update ai_run set status='completed' where id=$1", [runId])
          );
        }
      }
    }
  }
} finally {
  for (const client of clients) await client.close();
  await executeZeroTransaction(ctx, async tx => {
    await tx.dbTransaction.query('delete from studio_project where id=$1', [projectId]);
    if (groupId) await tx.dbTransaction.query('delete from "group" where id=$1', [groupId]);
    if (member) await tx.dbTransaction.query('delete from "user" where id=$1', [member.id]);
    await tx.dbTransaction.query('delete from "user" where id=$1', [actor]);
  });
  await admin.auth.admin.deleteUser(actor);
  if (member) await admin.auth.admin.deleteUser(member.id);
  await mkdir('output/studio', { recursive: true });
  await writeFile(
    groupId ? 'output/studio/group-smoke.json' : 'output/studio/smoke.json',
    JSON.stringify(report, null, 2)
  );
  await writeFile(
    `output/studio/smoke-${new Date().toISOString().replaceAll(':', '-')}.json`,
    JSON.stringify(report, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        checks: report.checks,
        models: report.models.map(m => {
          const { toolCalls, ...summary } = m as Record<string, unknown>;
          return { ...summary, toolCallCount: Array.isArray(toolCalls) ? toolCalls.length : 0 };
        }),
      },
      null,
      2
    )
  );
}
process.exit(process.exitCode ?? 0);
