import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import * as zeroRuntime from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import { studioSql } from '@/server/studio/db';
import { findAiTraces, insertAiOperation, insertAiTrace } from '@/server/ai-trace-store';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
const auth = vi.hoisted(() => ({ actor: '' }));
vi.mock('@/lib/supabase/server', () => ({
  getSession: async () => (auth.actor ? { user: { id: auth.actor } } : null),
}));
import { handleAiTraceRequest, Route } from '@/routes/api/ai/traces';

const database = new URL(
  process.env.ZERO_UPSTREAM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  throw new Error('Trace access tests require isolated local PostgreSQL');
const actor = crypto.randomUUID(),
  owner = crypto.randomUUID(),
  amendment = crypto.randomUUID(),
  documentId = crypto.randomUUID(),
  project = crypto.randomUUID(),
  personal = crypto.randomUUID(),
  projectChat = crypto.randomUUID();
const ctx = createZeroContext(actor);
const transaction = <T>(work: (tx: ZeroTransaction) => Promise<T>) =>
  executeZeroTransaction(ctx, work);
const query = (text: string, values: unknown[] = []) =>
  transaction(tx => rows(sqlTransaction(tx), text, values));
const request = (id: string) =>
  handleAiTraceRequest(new Request(`http://localhost/api/ai/traces?traceId=${id}`));

beforeAll(async () => {
  await query('insert into "user"(id) values($1),($2)', [actor, owner]);
  await query(
    "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Trace access','private')",
    [amendment, actor]
  );
  await query("insert into document(id,amendment_id,content) values($1,$2,'[]'::jsonb)", [
    documentId,
    amendment,
  ]);
  await query(
    "insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values($1,$2,'Trace access','single',5,0,0)",
    [project, actor]
  );
  await query("insert into conversation(id,type,assistant_for_user_id) values($1,'assistant',$2)", [
    personal,
    actor,
  ]);
  await transaction(tx =>
    projectChatSharedMutators.create.fn({
      tx,
      ctx,
      args: {
        id: projectChat,
        scope: { kind: 'studio', projectId: project },
        name: 'Trace access',
      },
    })
  );
});
beforeEach(async () => {
  auth.actor = actor;
  await query('update amendment set created_by_id=$2 where id=$1', [amendment, actor]);
  await query('update studio_project set owner_id=$2 where id=$1', [project, actor]);
  await query('update conversation set assistant_for_user_id=$2 where id=$1', [personal, actor]);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await query('delete from ai_diagnostics.ai_trace where actor_id=$1', [actor]);
  await query('delete from conversation where id in ($1,$2)', [personal, projectChat]);
  await query('delete from studio_project where id=$1', [project]);
  await query('delete from document where id=$1', [documentId]);
  await query('delete from amendment where id=$1', [amendment]);
  await query('delete from "user" where id in ($1,$2)', [actor, owner]);
  await studioSql().end();
});

async function trace(
  resource: {
    conversationId?: string;
    studioProjectId?: string;
    amendmentId?: string;
    documentId?: string;
  } = {}
) {
  const id = crypto.randomUUID();
  await insertAiTrace({
    id,
    actorId: actor,
    ...resource,
    surface: 'chat',
    invocation: 'project_chat',
    prompt: { content: 'Private prompt' },
  });
  return id;
}

it('returns an unfinished diagnostic operation without assigning a completion time', async () => {
  const id = await trace();
  const operationId = crypto.randomUUID();
  await insertAiOperation({
    id: operationId,
    trace_id: id,
    parent_operation_id: null,
    kind: 'model',
    name: 'Pending model',
    status: 'running',
    tool_call_id: null,
    attempt: 1,
    input: null,
    metadata: {},
    created_at: Date.now(),
    finished_at: null,
    output: null,
    error: null,
  });
  const result = await findAiTraces(actor, { traceId: id });
  expect(result).toHaveLength(1);
  expect(result[0].operations).toMatchObject([
    { id: operationId, status: 'running', finished_at: null },
  ]);
  expect(typeof result[0].operations[0].created_at).toBe('number');
});

it('rejects anonymous requests before opening a diagnostic transaction', async () => {
  auth.actor = '';
  const read = vi.spyOn(zeroRuntime, 'executeZeroRead');
  const response = await request(crypto.randomUUID());
  expect(response.status).toBe(401);
  expect(read).not.toHaveBeenCalled();
});

it.each(['', 'traceId=invalid', `traceId=${crypto.randomUUID()}&messageId=${crypto.randomUUID()}`])(
  'rejects invalid or ambiguous diagnostic selector %s',
  async selector => {
    const read = vi.spyOn(zeroRuntime, 'executeZeroRead');
    const response = await handleAiTraceRequest(
      new Request(`http://localhost/api/ai/traces?${selector}`)
    );
    expect(response.status).toBe(400);
    expect(read).not.toHaveBeenCalled();
  }
);

it.each([
  'studio',
  'amendment',
  'document',
  'project conversation',
  'personal conversation',
] as const)('rechecks current %s access before exposing persisted diagnostics', async kind => {
  const resource =
    kind === 'studio'
      ? { studioProjectId: project }
      : kind === 'amendment'
        ? { amendmentId: amendment }
        : kind === 'document'
          ? { documentId }
          : { conversationId: kind === 'project conversation' ? projectChat : personal };
  const id = await trace(resource);
  const authorized = await request(id);
  expect(authorized.status).toBe(200);
  expect(authorized.headers.get('Cache-Control')).toBe('no-store');
  expect((await authorized.json()).traces).toMatchObject([
    { id, prompt: { content: 'Private prompt' } },
  ]);
  if (kind === 'studio' || kind === 'project conversation')
    await query('update studio_project set owner_id=$2 where id=$1', [project, owner]);
  else if (kind === 'personal conversation')
    await query('update conversation set assistant_for_user_id=$2 where id=$1', [personal, owner]);
  else await query('update amendment set created_by_id=$2 where id=$1', [amendment, owner]);
  const revoked = await request(id);
  expect(revoked.status).toBe(200);
  expect(await revoked.json()).toEqual({ traces: [] });
});

it('requires every resource referenced by a diagnostic to remain accessible', async () => {
  const id = await trace({
    conversationId: projectChat,
    studioProjectId: project,
    amendmentId: amendment,
    documentId,
  });
  expect((await (await request(id)).json()).traces).toHaveLength(1);
  await query('update amendment set created_by_id=$2 where id=$1', [amendment, owner]);
  expect(await (await request(id)).json()).toEqual({ traces: [] });
});

it('uses the registered HTTP handler and returns empty diagnostics for another actor', async () => {
  const id = await trace();
  auth.actor = owner;
  const handler = (
    Route.options as unknown as {
      server: { handlers: { GET: (input: { request: Request }) => Promise<Response> } };
    }
  ).server.handlers.GET;
  const response = await handler({
    request: new Request(`http://localhost/api/ai/traces?traceId=${id}`),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ traces: [] });
});

it('returns a safe noncacheable error when diagnostic database access fails', async () => {
  const id = await trace();
  const failure = new Error('Database password=private-secret unavailable');
  vi.spyOn(zeroRuntime, 'executeZeroRead').mockRejectedValueOnce(failure);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const response = await request(id);
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ error: { version: 1, code: 'ai_operation_failed' } });
});

it('withholds a conversation diagnostic if its conversation is deleted between reading traces and checking access', async () => {
  const transient = crypto.randomUUID();
  await query("insert into conversation(id,type,assistant_for_user_id) values($1,'assistant',$2)", [
    transient,
    actor,
  ]);
  const id = await trace({ conversationId: transient });
  const read = zeroRuntime.executeZeroRead;
  let deleted = false;
  vi.spyOn(zeroRuntime, 'executeZeroRead').mockImplementation(work =>
    read(async tx => {
      const nativeQuery = tx.dbTransaction.query.bind(tx.dbTransaction);
      vi.spyOn(tx.dbTransaction, 'query').mockImplementation(async (sql, ...values) => {
        if (!deleted && /from\s+"?conversation"?/i.test(sql)) {
          deleted = true;
          await studioSql().unsafe('delete from conversation where id=$1', [transient]);
        }
        return nativeQuery(sql, ...values);
      });
      return work(tx);
    })
  );
  const response = await request(id);
  expect(deleted).toBe(true);
  expect(await response.json()).toEqual({ traces: [] });
  expect(await query('select id from ai_diagnostics.ai_trace where id=$1', [id])).toEqual([]);
});
