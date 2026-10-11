import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { isLocalTestDatabase } from '@/test/local-database';
const auth = vi.hoisted(() => ({ actor: '' }));
vi.mock('@/lib/supabase/server', () => ({
  getSession: async () => (auth.actor ? { user: { id: auth.actor } } : null),
}));
import { handleAiTraceRequest } from '@/routes/api/ai/traces';
import { startAiTrace, withAiTrace, traceAiOperation } from '../ai-trace';
import { findAiTraces, linkAiResponse } from '../ai-trace-store';
import { studioSql } from '../studio/db';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!isLocalTestDatabase(database)) throw new Error('Diagnostics tests require local database');
process.env.STUDIO_DATABASE_URL = database;
const sql = postgres(database, { max: 3 });
const actor = crypto.randomUUID(),
  other = crypto.randomUUID(),
  conversation = crypto.randomUUID(),
  message = crypto.randomUUID(),
  answer = crypto.randomUUID(),
  amendment = crypto.randomUUID();
const request = (selector: string) =>
  handleAiTraceRequest(new Request(`http://localhost/api/ai/traces?${selector}`));
beforeAll(async () => {
  auth.actor = actor;
  await sql`insert into "user"(id) values(${actor}),(${other})`;
  await sql`insert into conversation(id,type,assistant_for_user_id) values(${conversation},'assistant',${actor})`;
  await sql`insert into message(id,conversation_id,sender_id,content) values(${message},${conversation},${actor},'Original prompt'),(${answer},${conversation},${actor},'Result')`;
  await sql`insert into amendment(id,created_by_id,title,visibility) values(${amendment},${other},'Diagnostic fixture','private')`;
  await sql`insert into amendment_collaborator(id,amendment_id,user_id,status) values(${crypto.randomUUID()},${amendment},${actor},'active')`;
});
afterAll(async () => {
  await sql`delete from conversation where id=${conversation}`;
  await sql`delete from amendment where id=${amendment}`;
  await sql`delete from "user" where id in (${actor},${other})`;
  await sql.end();
  await studioSql().end();
});

it('persists lineage for reload and only returns the requesting actor’s diagnostics', async () => {
  const trace = await startAiTrace(
    {
      traceId: message,
      actorId: actor,
      originMessageId: message,
      conversationId: conversation,
      surface: 'chat',
      invocation: 'assistant_chat',
    },
    { content: 'Original prompt', apiKey: 'private-key' }
  );
  await withAiTrace(trace, () =>
    traceAiOperation('model', 'chat', { prompt: 'Original prompt' }, async () => {
      await traceAiOperation(
        'tool',
        'write',
        { id: '' },
        async () => ({ error: { code: 'ai_invalid_identifier' } }),
        { toolCallId: 'call-1' }
      );
      return { text: 'Result' };
    })
  );
  await linkAiResponse(message, answer);
  const response = await request(`messageId=${answer}`);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const { traces } = await response.json();
  expect(traces[0]).toMatchObject({
    id: message,
    origin_message_id: message,
    response_message_id: answer,
    prompt: { content: 'Original prompt', apiKey: '[redacted]' },
  });
  const model = traces[0].operations.find((value: { kind: string }) => value.kind === 'model');
  expect(
    traces[0].operations.find((value: { kind: string }) => value.kind === 'tool')
  ).toMatchObject({ status: 'failed', tool_call_id: 'call-1', parent_operation_id: model.id });
  auth.actor = other;
  expect(await (await request(`traceId=${message}`)).json()).toEqual({ traces: [] });
  auth.actor = actor;
});

it('rechecks current amendment access and rejects anonymous/invalid selectors', async () => {
  const id = crypto.randomUUID();
  await startAiTrace(
    {
      traceId: id,
      actorId: actor,
      amendmentId: amendment,
      surface: 'city_design',
      invocation: 'project_chat',
    },
    { content: 'City prompt' }
  );
  expect((await (await request(`traceId=${id}`)).json()).traces).toHaveLength(1);
  await sql`delete from amendment_collaborator where amendment_id=${amendment} and user_id=${actor}`;
  expect(await (await request(`traceId=${id}`)).json()).toEqual({ traces: [] });
  expect((await request('traceId=')).status).toBe(400);
  expect((await request(`traceId=${id}&messageId=${message}`)).status).toBe(400);
  auth.actor = '';
  expect((await request(`traceId=${id}`)).status).toBe(401);
  auth.actor = actor;
});

it('keeps diagnostics outside replication/direct client access and purges deleted message payloads', async () => {
  expect(
    await sql`select tablename from pg_publication_tables where tablename in ('ai_trace','ai_trace_operation')`
  ).toHaveLength(0);
  expect(
    await sql`select has_table_privilege('authenticated','ai_diagnostics.ai_trace','SELECT') as allowed`
  ).toMatchObject([{ allowed: false }]);
  await sql`update message set deleted_at=now() where id=${message}`;
  expect(await findAiTraces(actor, { traceId: message })).toHaveLength(0);
  expect(
    await sql`select id from ai_diagnostics.ai_trace_operation where trace_id=${message}`
  ).toHaveLength(0);
  await sql`delete from amendment where id=${amendment}`;
  expect(
    await sql`select id from ai_diagnostics.ai_trace where amendment_id=${amendment}`
  ).toHaveLength(0);
});
