import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AiAccessError } from '@/lib/ai/errors';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import {
  aiChatStartRequestSchema,
  type AiChatRequest,
  type AiChatStartRequest,
} from '@/server/ai-types';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
import { handleProjectAiChat } from '../run';
import { DEFAULT_AI_SKILLS } from '@/features/assistant/logic/defaultAiSkills';
import { createStudioDocumentV5 } from '@/features/communication-studio/logic/document-v3';
import * as transactions from '@/server/transaction';
import * as zeroRuntime from '@/server/zero-mutate';

const provider = vi.hoisted(() => ({
  stream: vi.fn(),
  resolve: vi.fn(),
  models: [
    {
      provider: 'openai',
      id: 'test-model',
      source: 'byok',
      supports_tools: true,
      context_window: 64000 as number | null,
    },
  ],
}));
vi.mock('ai', async original => ({
  ...(await original<typeof import('ai')>()),
  streamText: provider.stream,
}));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: async () => ({ models: provider.models }),
  resolveLanguageModelForUser: provider.resolve,
}));

const database = new URL(
  process.env.ZERO_UPSTREAM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  throw new Error('Run boundary tests require isolated local PostgreSQL');
const assistantId = 'a12a0000-0000-4000-a000-000000000001';
beforeEach(() => {
  vi.clearAllMocks();
  provider.models = [
    {
      provider: 'openai',
      id: 'test-model',
      source: 'byok',
      supports_tools: true,
      context_window: 64000,
    },
  ];
  provider.resolve.mockReset().mockResolvedValue({ model: {}, providerOptions: {} });
  provider.stream.mockReset().mockImplementation(() => ({
    fullStream: (async function* () {
      yield { type: 'text-delta', text: 'Completed reply' };
    })(),
    response: Promise.resolve({ messages: [{ role: 'assistant', content: 'Completed reply' }] }),
    toolCalls: Promise.resolve([]),
    finishReason: Promise.resolve('stop'),
  }));
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

interface Fixture {
  actor: string;
  scopeId: string;
  conversationId: string;
  body: AiChatStartRequest;
  transaction: <T>(work: (tx: ZeroTransaction) => Promise<T>) => Promise<T>;
  query: (text: string, values?: unknown[]) => Promise<Record<string, unknown>[]>;
  send: (body?: AiChatRequest, actor?: string, request?: Request) => Promise<Response | null>;
}
async function withFixture(work: (fixture: Fixture) => Promise<void>, studio = false) {
  const actor = crypto.randomUUID(),
    scopeId = crypto.randomUUID(),
    conversationId = crypto.randomUUID();
  const ctx = createZeroContext(actor);
  const transaction: Fixture['transaction'] = work => executeZeroTransaction(ctx, work);
  const query: Fixture['query'] = (text, values = []) =>
    transaction(tx => rows(sqlTransaction(tx), text, values));
  await transaction(async tx => {
    const sql = sqlTransaction(tx);
    await sql.query('insert into "user"(id) values($1),($2) on conflict do nothing', [
      actor,
      assistantId,
    ]);
    if (studio) {
      await sql.query(
        "insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values($1,$2,'Run boundaries','single',5,$3,$3)",
        [scopeId, actor, Date.now()]
      );
      await sql.query(
        'insert into studio_state(project_id,document,updated_at) values($1,$2::jsonb,0)',
        [scopeId, createStudioDocumentV5('Run boundaries', 'single')]
      );
    } else
      await sql.query(
        "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Run boundaries','private')",
        [scopeId, actor]
      );
    await projectChatSharedMutators.create.fn({
      tx,
      ctx,
      args: {
        id: conversationId,
        scope: studio
          ? { kind: 'studio', projectId: scopeId }
          : { kind: 'amendment', amendmentId: scopeId },
        name: 'Run boundaries',
      },
    });
  });
  const body = aiChatStartRequestSchema.parse({
    conversationId,
    requestId: crypto.randomUUID(),
    content: 'Summarize the project',
    model: { provider: 'openai', id: 'test-model', source: 'byok' },
  });
  const fixture: Fixture = {
    actor,
    scopeId,
    conversationId,
    body,
    transaction,
    query,
    send: (input = body, user = actor, request = new Request('http://localhost/api/ai/chat')) =>
      handleProjectAiChat(user, input, request),
  };
  try {
    await work(fixture);
  } finally {
    await query('delete from conversation where id=$1', [conversationId]);
    if (studio) await query('delete from canvas_proposal where project_id=$1', [scopeId]);
    await query(
      studio ? 'delete from studio_project where id=$1' : 'delete from amendment where id=$1',
      [scopeId]
    );
    await query('delete from "user" where id=$1', [actor]);
  }
}

async function savedRun(
  fixture: Fixture,
  options: { configuration?: boolean; status?: string; step?: number; expired?: boolean } = {}
) {
  const id = crypto.randomUUID();
  const configuration =
    options.configuration === false
      ? {}
      : {
          request: fixture.body,
          selectedSkills: [],
          personalToolNames: ['present_findings'],
          sharedAttachments: [],
          projectToolNames: [],
          surface: null,
        };
  await fixture.query(
    "insert into ai_run(id,conversation_id,actor_id,request_id,status,request_hash,model,editor_context,configuration,messages,step,lease_token,lease_expires_at,created_at,updated_at) values($1,$2,$3,$4,$5,'saved-request',$6::jsonb,$12::jsonb,$7::jsonb,'[]'::jsonb,$8,$9,$10,$11,$11)",
    [
      id,
      fixture.conversationId,
      fixture.actor,
      fixture.body.requestId,
      options.status ?? 'interrupted',
      fixture.body.model,
      configuration,
      options.step ?? 0,
      crypto.randomUUID(),
      Date.now() + (options.expired ? -1000 : 120000),
      Date.now(),
      fixture.body.editorContext ?? {},
    ]
  );
  if (options.configuration !== false)
    await fixture.query(
      'insert into message(id,conversation_id,sender_id,content,is_read,created_at,updated_at) values($1,$2,$3,$4,false,$5,$5)',
      [
        fixture.body.requestId,
        fixture.conversationId,
        fixture.actor,
        fixture.body.content,
        Date.now(),
      ]
    );
  return id;
}

async function savedCall(
  fixture: Fixture,
  runId: string,
  name: string,
  status = 'pending',
  input: unknown = {},
  result?: unknown,
  identity = crypto.randomUUID()
) {
  await fixture.query(
    'insert into ai_tool_call(run_id,tool_call_id,tool_name,input_hash,input,status,result,created_at,updated_at) values($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$8)',
    [runId, identity, name, JSON.stringify(input), input, status, result ?? null, Date.now()]
  );
  return identity;
}

it('restores a legacy saved request from its user message when the run has no configuration or editor hints', () =>
  withFixture(async f => {
    await savedRun(f, { configuration: false });
    await f.query(
      'insert into message(id,conversation_id,sender_id,content,is_read,created_at,updated_at) values($1,$2,$3,$4,false,$5,$5)',
      [f.body.requestId, f.conversationId, f.actor, f.body.content, Date.now()]
    );
    const response = await f.send(resume(f));
    expect(response?.status).toBe(200);
    expect(await response!.text()).toContain('Completed reply');
    expect(provider.resolve).toHaveBeenCalledWith(f.actor, f.body.model, 'medium');
  }));

it('refuses oversized historical context before creating a new run', () =>
  withFixture(async f => {
    await f.query(
      'insert into message(id,conversation_id,sender_id,content,is_read,created_at,updated_at) values($1,$2,$3,$4,false,$5,$5)',
      [crypto.randomUUID(), f.conversationId, f.actor, 'a'.repeat(210000), Date.now()]
    );
    expect(await errorCode(await f.send(), 400)).toBe('context_too_large');
    expect(
      await f.query('select id from ai_run where conversation_id=$1', [f.conversationId])
    ).toEqual([]);
    expect(
      await f.query('select id from message where conversation_id=$1', [f.conversationId])
    ).toHaveLength(1);
  }));

it('preserves empty historical messages and uses the default model context window when its size is unknown', () =>
  withFixture(async f => {
    provider.models[0].context_window = null;
    await f.query(
      'insert into message(conversation_id,sender_id,content,is_read,created_at,updated_at) values($1,$2,null,false,$4,$4),($1,$3,null,false,$5,$5)',
      [f.conversationId, f.actor, assistantId, Date.now() - 2, Date.now() - 1]
    );
    const response = await f.send();
    await response!.text();
    expect(provider.stream.mock.calls[0][0].messages.slice(0, 2)).toEqual([
      { role: 'user', content: '' },
      { role: 'assistant', content: '' },
    ]);
  }));

it('records an interrupted previous tool as a durable clarification result without repeating its side effects', () =>
  withFixture(async f => {
    const runId = await savedRun(f);
    await savedCall(f, runId, 'amendment_read', 'failed');
    const response = await f.send(resume(f));
    expect(await response!.text()).toContain('tool-result');
    const call = (
      await f.query('select status,result from ai_tool_call where run_id=$1', [runId])
    )[0];
    expect(call).toMatchObject({
      status: 'completed',
      result: { error: { code: 'tool_execution_interrupted', recovery: 'ask_user' } },
    });
    const context = JSON.parse(
      String(
        (await f.query('select context_json from message where id=$1', [runId]))[0].context_json
      )
    );
    expect(context.project.outcome).toBe('needs_clarification');
  }));

it('stores a safe error for a valid personal tool absent from the saved run selection', () =>
  withFixture(async f => {
    const runId = await savedRun(f);
    await savedCall(f, runId, 'find_my_todos');
    const response = await f.send(resume(f));
    await response!.text();
    expect(
      (await f.query('select result from ai_tool_call where run_id=$1', [runId]))[0].result
    ).toMatchObject({ error: { code: 'tool_not_available' } });
    expect(
      JSON.parse(
        String(
          (await f.query('select context_json from message where id=$1', [runId]))[0].context_json
        )
      ).project.outcome
    ).toBe('failed');
  }));

it('skips retired personal tool definitions and stores a useful unavailable receipt when resuming an older configuration', () =>
  withFixture(async f => {
    const runId = await savedRun(f);
    await f.query(
      "update ai_run set configuration=jsonb_set(configuration,'{personalToolNames}',$2::jsonb) where id=$1",
      [runId, ['retired_tool']]
    );
    await savedCall(f, runId, 'retired_tool');
    const response = await f.send(resume(f));
    await response!.text();
    expect(
      (await f.query('select result from ai_tool_call where run_id=$1', [runId]))[0].result
    ).toMatchObject({ error: { code: 'tool_not_available' } });
  }));

it.each(['same-input', 'two-failures'])(
  'enforces the repair budget from durable previous failures (%s)',
  scenario =>
    withFixture(async f => {
      const runId = await savedRun(f);
      const input = { limit: 10 };
      await savedCall(
        f,
        runId,
        'amendment_read',
        'completed',
        scenario === 'same-input' ? input : { limit: 5 },
        { error: { code: 'invalid_actions' } }
      );
      if (scenario === 'two-failures')
        await savedCall(
          f,
          runId,
          'amendment_read',
          'completed',
          { limit: 6 },
          { error: { code: 'invalid_actions' } }
        );
      await savedCall(f, runId, 'amendment_read', 'pending', input);
      const response = await f.send(resume(f));
      await response!.text();
      const results = await f.query(
        'select result from ai_tool_call where run_id=$1 order by created_at',
        [runId]
      );
      expect(results.at(-1)?.result).toMatchObject({
        error: { code: 'repair_limit', recovery: 'ask_user' },
      });
    })
);

it('converts invalid project tool arguments into an atomic safe receipt and continues the response', () =>
  withFixture(async f => {
    const runId = await savedRun(f);
    await savedCall(f, runId, 'amendment_read', 'pending', { offset: -1 });
    const response = await f.send(resume(f));
    expect(await response!.text()).toContain('completed');
    expect(
      (await f.query('select result from ai_tool_call where run_id=$1', [runId]))[0].result
    ).toMatchObject({ error: { code: 'invalid_actions', recovery: 'read_again' } });
  }));

it('uses a readable completion fallback when the resumed model returns no text or further calls', () =>
  withFixture(async f => {
    await savedRun(f);
    provider.stream.mockReturnValueOnce({
      fullStream: (async function* () {
        yield* [];
      })(),
      response: Promise.resolve({ messages: [] }),
      toolCalls: Promise.resolve([]),
      finishReason: Promise.resolve('stop'),
    });
    const response = await f.send(resume(f));
    await response!.text();
    expect(
      (
        await f.query('select content from message where conversation_id=$1 and sender_id=$2', [
          f.conversationId,
          assistantId,
        ])
      )[0].content
    ).toBe('Done.');
  }));

it('treats an SDK error finish reason as interrupted and does not publish an assistant reply', () =>
  withFixture(async f => {
    provider.stream.mockReturnValueOnce({
      fullStream: (async function* () {
        yield* [];
      })(),
      response: Promise.resolve({ messages: [] }),
      toolCalls: Promise.resolve([]),
      finishReason: Promise.resolve('error'),
    });
    const response = await f.send();
    expect(await response!.text()).toContain('run_interrupted');
    expect(
      await f.query('select id from message where conversation_id=$1 and sender_id=$2', [
        f.conversationId,
        assistantId,
      ])
    ).toEqual([]);
  }));

it('stops a request that was already aborted before the model stream was established', () =>
  withFixture(async f => {
    const cancelled = new AbortController();
    cancelled.abort();
    const response = await f.send(
      f.body,
      f.actor,
      new Request('http://localhost/api/ai/chat', { signal: cancelled.signal })
    );
    expect(await response!.text()).toContain('run_interrupted');
    expect(provider.stream).not.toHaveBeenCalled();
  }));
const resume = (fixture: Fixture): AiChatRequest => ({
  conversationId: fixture.conversationId,
  requestId: fixture.body.requestId!,
  resume: true,
});

it('restores a legacy saved editor context against the current amendment document', () =>
  withFixture(async f => {
    const documentId = crypto.randomUUID();
    await f.query(
      "insert into document(id,amendment_id,editing_mode,content) values($1,$2,'edit',$3::jsonb)",
      [documentId, f.scopeId, [{ type: 'p', children: [{ text: 'Current text' }] }]]
    );
    await f.query('update amendment set document_id=$2 where id=$1', [f.scopeId, documentId]);
    f.body.editorContext = { surface: 'amendment_text', documentId, contentRevision: 0 };
    await savedRun(f, { configuration: false });
    await f.query(
      'insert into message(id,conversation_id,sender_id,content,is_read,created_at,updated_at) values($1,$2,$3,$4,false,$5,$5)',
      [f.body.requestId, f.conversationId, f.actor, f.body.content, Date.now()]
    );
    const response = await f.send(resume(f));
    expect(response?.status).toBe(200);
    expect(await response!.text()).toContain('Completed reply');
  }));

it.each(['renew', 'cancel', 'lease-lost'] as const)(
  'handles native heartbeat transactions without overlapping renewal or overwriting a newer owner (%s)',
  scenario =>
    withFixture(async f => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      let finish!: () => void;
      const paused = new Promise<void>(resolve => {
        finish = resolve;
      });
      provider.stream.mockReturnValueOnce({
        fullStream: (async function* () {
          await paused;
          yield* [];
        })(),
        response: Promise.resolve({ messages: [] }),
        toolCalls: Promise.resolve([]),
        finishReason: Promise.resolve('stop'),
      });
      const response = await f.send();
      await vi.waitFor(() => expect(provider.stream).toHaveBeenCalledOnce(), { timeout: 5000 });
      const run = (
        await f.query('select id,lease_expires_at from ai_run where conversation_id=$1', [
          f.conversationId,
        ])
      )[0];
      if (scenario === 'cancel')
        await f.query("update ai_run set status='cancelled' where id=$1", [run.id]);
      if (scenario === 'lease-lost')
        await f.query('update ai_run set lease_token=$2 where id=$1', [
          run.id,
          crypto.randomUUID(),
        ]);
      // The second tick arrives while the first native PostgreSQL transaction is pending.
      vi.advanceTimersByTime(15000);
      vi.advanceTimersByTime(15000);
      if (scenario === 'renew')
        await vi.waitFor(
          async () => {
            const updated = (
              await f.query('select lease_expires_at from ai_run where id=$1', [run.id])
            )[0];
            expect(Number(updated.lease_expires_at)).toBeGreaterThan(Number(run.lease_expires_at));
          },
          { timeout: 5000 }
        );
      else
        await vi.waitFor(
          () => expect(provider.stream.mock.calls[0][0].abortSignal.aborted).toBe(true),
          { timeout: 5000 }
        );
      finish();
      const events = await response!.text();
      expect(events).toContain(scenario === 'renew' ? 'completed' : 'run_interrupted');
      expect((await f.query('select status from ai_run where id=$1', [run.id]))[0].status).toBe(
        scenario === 'renew' ? 'completed' : scenario === 'cancel' ? 'cancelled' : 'running'
      );
      expect(vi.getTimerCount()).toBe(0);
    })
);

it('streams successive text deltas, skips reasoning parts and publishes only the accumulated assistant text', () =>
  withFixture(async f => {
    provider.stream.mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: 'reasoning-delta', text: 'Private reasoning' };
        yield { type: 'text-delta', text: 'Hello' };
        yield { type: 'text-delta', text: ' world' };
      })(),
      response: Promise.resolve({ messages: [{ role: 'assistant', content: 'Hello world' }] }),
      toolCalls: Promise.resolve([]),
      finishReason: Promise.resolve('stop'),
    });
    const response = await f.send();
    const text = await response!.text();
    expect(text).not.toContain('Private reasoning');
    expect(text).toContain('"text":"Hello"');
    expect(text).toContain('"text":" world"');
    expect(
      (
        await f.query('select content from message where conversation_id=$1 and sender_id=$2', [
          f.conversationId,
          assistantId,
        ])
      )[0].content
    ).toBe('Hello world');
  }));

it('supports a legacy model descriptor without a credential source while retaining the actor boundary', () =>
  withFixture(async f => {
    f.body.model = { provider: 'openai', id: 'test-model' };
    const response = await f.send();
    expect(await response!.text()).toContain('completed');
    expect(provider.resolve).toHaveBeenCalledWith(f.actor, f.body.model, 'medium');
  }));
async function errorCode(response: Response | null, status: number) {
  expect(response?.status).toBe(status);
  return (await response!.json()).error.code;
}

it.each(['byok', undefined] as const)(
  'resumes a durable Studio suggestion receipt with model source %s and filters legacy attachment references',
  source =>
    withFixture(async f => {
      f.body.model = { provider: 'openai', id: 'test-model', ...(source ? { source } : {}) };
      const runId = await savedRun(f);
      const callId = await savedCall(f, runId, 'studio_generate_suggestion');
      const proposalId = crypto.randomUUID();
      await f.query(
        `insert into canvas_proposal(id,project_id,owner_id,title,base_document,base_revision,base_generation,document,origin,ai_request_key,created_at,updated_at)
      select $1,p.id,$2,'Durable suggestion',s.document,0,c.generation,s.document,'ai',$3,0,0
      from studio_project p join studio_state s on s.project_id=p.id join canvas_control c on c.project_id=p.id where p.id=$4`,
        [proposalId, f.actor, `${runId}:${callId}`, f.scopeId]
      );
      await f.query(
        "update ai_run set configuration=jsonb_set(configuration,'{sharedAttachments}',$2::jsonb) where id=$1",
        [
          runId,
          [
            { entityType: 'todo', entityId: crypto.randomUUID() },
            { entityType: 'retired-entity', entityId: 'old' },
            { entityType: 'todo', entityId: null },
          ],
        ]
      );
      await savedCall(f, runId, 'studio_catalog', 'completed', { group: 'media' }, { tools: [] });
      await savedCall(f, runId, 'studio_catalog', 'completed', {}, null);
      const response = await f.send(resume(f));
      expect(await response!.text()).toContain('completed');
      const [call] = await f.query(
        'select status,result from ai_tool_call where run_id=$1 and tool_call_id=$2',
        [runId, callId]
      );
      expect(call).toMatchObject({
        status: 'completed',
        result: { proposalId, status: 'proposed' },
      });
      const [message] = await f.query('select context_json from message where id=$1', [runId]);
      expect(JSON.parse(message.context_json as string).project.outcome).toBe('proposed');
      expect(provider.stream.mock.calls[0][0].activeTools).toContain('studio_catalog');
      expect(
        await f.query('select id from canvas_proposal where project_id=$1', [f.scopeId])
      ).toHaveLength(1);
    }, true)
);

it('links a persisted project tool to the preceding native model operation', () =>
  withFixture(async f => {
    let step = 0;
    provider.stream.mockImplementation(options => {
      const call =
        step++ === 0
          ? {
              toolCallId: 'read-context',
              toolName: 'amendment_read',
              input: { offset: 0, limit: 20 },
            }
          : null;
      return {
        fullStream: (async function* () {
          await options.onStepStart({
            modelId: 'test-model',
            provider: 'openai',
            stepNumber: step,
            messages: options.messages,
          });
          if (!call) yield { type: 'text-delta', text: 'Checked project' };
          await options.onStepEnd({
            content: [],
            toolCalls: call ? [call] : [],
            finishReason: call ? 'tool-calls' : 'stop',
            text: call ? '' : 'Checked project',
          });
        })(),
        response: Promise.resolve({
          messages: [
            {
              role: 'assistant',
              content: call ? [{ type: 'tool-call', ...call }] : 'Checked project',
            },
          ],
        }),
        toolCalls: Promise.resolve(call ? [call] : []),
        finishReason: Promise.resolve(call ? 'tool-calls' : 'stop'),
      };
    });
    expect(await (await f.send())!.text()).toContain('completed');
    const operations = await f.query(
      'select id,parent_operation_id,kind from ai_diagnostics.ai_trace_operation where trace_id=$1',
      [f.body.requestId]
    );
    const tool = operations.find(row => row.kind === 'tool');
    expect(tool).toBeDefined();
    expect(operations).toContainEqual(
      expect.objectContaining({ id: tool!.parent_operation_id, kind: 'model' })
    );
  }));

it('interrupts the run instead of recording a recoverable tool result when the personal tool data boundary loses access', () =>
  withFixture(async f => {
    const runId = await savedRun(f);
    await f.query(
      "update ai_run set configuration=jsonb_set(configuration,'{personalToolNames}','[\"find_my_todos\"]'::jsonb) where id=$1",
      [runId]
    );
    await savedCall(f, runId, 'find_my_todos');
    const originalRead = zeroRuntime.executeZeroRead;
    vi.spyOn(zeroRuntime, 'executeZeroRead').mockImplementation(callback =>
      originalRead(async tx => {
        const query = tx.dbTransaction.query.bind(tx.dbTransaction);
        const failure = vi.spyOn(tx.dbTransaction, 'query').mockImplementation((sql, args) => {
          if (/\bfrom\s+(?:"public"\.)?"?todo"?\b/i.test(sql))
            throw new AiAccessError('ai_access_unavailable', 'internal data access failure');
          return query(sql, args);
        });
        try {
          return await callback(tx);
        } finally {
          failure.mockRestore();
        }
      })
    );
    const events = await (await f.send(resume(f)))!.text();
    expect(events).toContain('ai_access_unavailable');
    expect(events).not.toContain('internal data access failure');
    expect(
      (await f.query('select status,error_code from ai_run where id=$1', [runId]))[0]
    ).toMatchObject({ status: 'interrupted', error_code: 'ai_access_unavailable' });
    expect(
      (await f.query('select status,result from ai_tool_call where run_id=$1', [runId]))[0]
    ).toMatchObject({ status: 'pending', result: null });
  }));

it.each(['missing', 'actor', 'expired'] as const)(
  'stops streaming when the durable lease becomes %s',
  scenario =>
    withFixture(async f => {
      provider.stream.mockImplementationOnce(() => ({
        fullStream: (async function* () {
          if (scenario === 'missing')
            await f.query('delete from ai_run where request_id=$1', [f.body.requestId]);
          if (scenario === 'actor')
            await f.query('update ai_run set actor_id=$2 where request_id=$1', [
              f.body.requestId,
              assistantId,
            ]);
          if (scenario === 'expired')
            await f.query('update ai_run set lease_expires_at=0 where request_id=$1', [
              f.body.requestId,
            ]);
          yield { type: 'text-delta', text: 'Uncommitted partial response' };
        })(),
      }));
      expect(await (await f.send())!.text()).toContain('run_interrupted');
      expect(
        await f.query('select id from message where conversation_id=$1 and sender_id=$2', [
          f.conversationId,
          assistantId,
        ])
      ).toEqual([]);
    })
);

it('returns the original stream error even when the database cannot persist its interruption status', () =>
  withFixture(async f => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    provider.stream.mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: 'error', error: new Error('provider connection closed') };
      })(),
    });
    const original = transactions.sqlTransaction;
    vi.spyOn(transactions, 'sqlTransaction').mockImplementation(tx => {
      const connection = original(tx);
      return {
        query: async (sql, args) => {
          if (sql.includes("status='interrupted',error_code=$3"))
            throw new Error('database interruption write failed');
          return connection.query(sql, args);
        },
      };
    });
    expect(await (await f.send())!.text()).toContain('operation_failed');
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('ai.persistence.failed'));
  }));

it('interrupts an active native request as soon as its client aborts', () =>
  withFixture(async f => {
    const controller = new AbortController();
    provider.stream.mockReturnValueOnce({
      fullStream: (async function* () {
        controller.abort();
        yield { type: 'reasoning-delta', text: 'private' };
      })(),
      response: Promise.resolve({ messages: [] }),
      toolCalls: Promise.resolve([]),
      finishReason: Promise.resolve('stop'),
    });
    expect(
      await (await f.send(
        f.body,
        f.actor,
        new Request('http://localhost/api/ai/chat', { signal: controller.signal })
      ))!.text()
    ).toContain('run_interrupted');
    expect(provider.stream.mock.calls[0][0].abortSignal.aborted).toBe(true);
  }));

it('rejects a legacy run with no saved user message or editor context before invoking its model', () =>
  withFixture(async f => {
    const id = await savedRun(f, { configuration: false });
    await f.query("update ai_run set editor_context='null'::jsonb where id=$1", [id]);
    expect(await errorCode(await f.send(resume(f)), 400)).toBe('invalid_actions');
    expect(provider.stream).not.toHaveBeenCalled();
  }));

it('leaves personal conversations to the personal chat handler', () =>
  withFixture(async f => {
    await f.query("update conversation set type='group' where id=$1", [f.conversationId]);
    expect(await f.send()).toBeNull();
    expect(provider.resolve).not.toHaveBeenCalled();
  }));

it('omits inaccessible personal uploads instead of trusting their client-supplied context in the shared chat', () =>
  withFixture(async f => {
    f.body.attachments = [
      {
        entityType: 'document',
        entityId: 'editor-uploads/private-file',
        title: 'PRIVATE-UPLOAD-SENTINEL',
        prompt_context: 'PRIVATE-CONTENT-SENTINEL',
      },
    ];
    expect(await (await f.send())!.text()).toContain('completed');
    expect(JSON.stringify(provider.stream.mock.calls[0][0].messages)).not.toContain('PRIVATE-');
    const [stored] = await f.query('select context_json from message where id=$1', [
      f.body.requestId,
    ]);
    expect(JSON.parse(stored.context_json as string).attachments).toEqual([]);
  }));

it('refuses a legacy project conversation whose project reference has been cleared', () =>
  withFixture(async f => {
    await f.query('update conversation set amendment_id=null where id=$1', [f.conversationId]);
    expect(await errorCode(await f.send(), 403)).toBe('permission_denied');
    expect(provider.stream).not.toHaveBeenCalled();
  }));

it('rejects a malformed request identity before writing any run or user message', () =>
  withFixture(async f => {
    expect(await errorCode(await f.send({ ...f.body, requestId: 'invalid-id' }), 400)).toBe(
      'invalid_actions'
    );
    expect(
      await f.query('select id from ai_run where conversation_id=$1', [f.conversationId])
    ).toEqual([]);
    expect(
      await f.query('select id from message where conversation_id=$1', [f.conversationId])
    ).toEqual([]);
  }));

it('denies an actor who has no current rights to the private project', () =>
  withFixture(async f => {
    expect(await errorCode(await f.send(f.body, crypto.randomUUID()), 403)).toBe(
      'permission_denied'
    );
    expect(provider.stream).not.toHaveBeenCalled();
  }));

it('rejects resumption when no saved run exists for the requested actor and identity', () =>
  withFixture(async f => {
    expect(await errorCode(await f.send(resume(f)), 400)).toBe('resume_unavailable');
  }));

it('requires a currently available model before creating a run', () =>
  withFixture(async f => {
    provider.models = [];
    expect(await errorCode(await f.send(), 400)).toBe('ai_model_unavailable');
    expect(
      await f.query('select id from ai_run where conversation_id=$1', [f.conversationId])
    ).toEqual([]);
  }));

it('requires tool support for a Studio project without changing the durable chat', () =>
  withFixture(async f => {
    provider.models[0].supports_tools = false;
    expect(await errorCode(await f.send(), 400)).toBe('model_tools_unsupported');
    expect(provider.resolve).not.toHaveBeenCalled();
  }, true));

it.each([
  'ai_workspace_invalid',
  'ai_workspace_unavailable',
  'ai_invalid_identifier',
  'ai_provider_rate_limited',
  'ai_credentials_missing',
] as const)('returns a safe actionable model-access error (%s)', code =>
  withFixture(async f => {
    provider.resolve.mockRejectedValueOnce(
      new AiAccessError(code, 'provider secret must not escape')
    );
    const response = await f.send();
    expect(response?.status).toBe(400);
    const error = (await response!.json()).error;
    expect(error.code).toBe(code);
    expect(error.recovery).toBe(
      code === 'ai_provider_rate_limited'
        ? 'retry_later'
        : code === 'ai_credentials_missing'
          ? 'choose_model'
          : 'read_again'
    );
    expect(JSON.stringify(error)).not.toContain('provider secret');
  })
);

it('rejects changed content under a saved request identity instead of replaying it', () =>
  withFixture(async f => {
    await savedRun(f);
    expect(await errorCode(await f.send(), 400)).toBe('idempotency_conflict');
    expect(provider.stream).not.toHaveBeenCalled();
  }));

it('refuses a second request while another run has a current lease', () =>
  withFixture(async f => {
    await savedRun(f, { status: 'running' });
    expect(await errorCode(await f.send({ ...f.body, requestId: crypto.randomUUID() }), 409)).toBe(
      'run_active'
    );
    expect(provider.stream).not.toHaveBeenCalled();
  }));

it('interrupts an expired previous run and accepts a fresh request', () =>
  withFixture(async f => {
    const oldId = await savedRun(f, { status: 'running', expired: true });
    const response = await f.send({ ...f.body, requestId: crypto.randomUUID() });
    expect(await response!.text()).toContain('Completed reply');
    expect((await f.query('select status from ai_run where id=$1', [oldId]))[0].status).toBe(
      'interrupted'
    );
  }));

it.each(['completed', 'cancelled'])(
  'replays a terminal %s run without invoking the model again or duplicating messages',
  status =>
    withFixture(async f => {
      const first = await f.send();
      await first!.text();
      const stored = (
        await f.query('select id from ai_run where conversation_id=$1', [f.conversationId])
      )[0];
      if (status === 'cancelled')
        await f.query("update ai_run set status='cancelled' where id=$1", [stored.id]);
      const calls = provider.stream.mock.calls.length;
      const response = await f.send();
      expect(await response!.text()).toContain(`"status":"${status}"`);
      expect(provider.stream).toHaveBeenCalledTimes(calls);
      expect(
        await f.query('select id from message where conversation_id=$1', [f.conversationId])
      ).toHaveLength(2);
    })
);

it('enforces the saved step limit when resuming a run', () =>
  withFixture(async f => {
    await savedRun(f, { step: 12 });
    const response = await f.send(resume(f));
    expect(await response!.text()).toContain('step_limit');
    expect(provider.stream).not.toHaveBeenCalled();
    expect(
      (
        await f.query('select status,error_code from ai_run where conversation_id=$1', [
          f.conversationId,
        ])
      )[0]
    ).toMatchObject({ status: 'interrupted', error_code: 'step_limit' });
  }));

it('persists enabled custom and built-in skills and prunes disabled, unknown and unavailable tools', () =>
  withFixture(async f => {
    await f.query(
      "insert into ai_skill(user_id,slug,name,system_prompt,enabled) values($1,'custom','Custom','Custom instructions',true),($1,'disabled','Disabled','Disabled instructions',false)",
      [f.actor]
    );
    await f.query(
      "insert into ai_tool(user_id,tool_name,enabled) values($1,'find_my_todos',false)",
      [f.actor]
    );
    const response = await f.send({
      ...f.body,
      skillSlugs: ['custom', 'disabled', 'unknown', DEFAULT_AI_SKILLS[0].slug],
      toolNames: ['find_my_todos', 'read_polity_docs'],
    });
    await response!.text();
    const configuration = (
      await f.query('select configuration from ai_run where conversation_id=$1', [f.conversationId])
    )[0].configuration as { selectedSkills: { slug: string }[]; personalToolNames: string[] };
    expect(configuration.selectedSkills.map(skill => skill.slug)).toEqual([
      'custom',
      DEFAULT_AI_SKILLS[0].slug,
    ]);
    expect(configuration.personalToolNames).toEqual(['read_polity_docs', 'present_findings']);
  }));
