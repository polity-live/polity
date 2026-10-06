import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const store = vi.hoisted(() => ({
  insertAiTrace: vi.fn(),
  insertAiOperation: vi.fn(),
  finishAiOperation: vi.fn(),
}));
vi.mock('../ai-trace-store', () => store);
import {
  withAiTrace,
  traceAiOperation,
  currentAiTrace,
  normalizeAiError,
  redactAiValue,
  startAiOperation,
  endAiOperation,
  startAiTrace,
  logAiEvent,
} from '../ai-trace';
import { aiProviderFetch, retryAfterMs } from '../ai-provider-fetch';

const root = (id: string) => ({
  traceId: id,
  actorId: 'actor',
  originMessageId: `message-${id}`,
  surface: 'city_design',
  invocation: 'project_chat',
  retryProvider: true,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubEnv('AI_LOG_FORMAT', undefined);
  vi.stubEnv('AI_LOG_PROMPTS', undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function logRecords() {
  return [console.info, console.warn, console.error].flatMap(logger =>
    vi
      .mocked(logger)
      .mock.calls.map(([value]) => JSON.parse(String(value)) as Record<string, unknown>)
  );
}

describe('AI console presentation', () => {
  it.each([
    {
      environment: 'development',
      format: undefined,
      prompts: undefined,
      pretty: true,
      includesPrompt: true,
    },
    {
      environment: 'production',
      format: undefined,
      prompts: undefined,
      pretty: false,
      includesPrompt: false,
    },
    {
      environment: 'development',
      format: 'json',
      prompts: 'true',
      pretty: false,
      includesPrompt: true,
    },
    {
      environment: 'production',
      format: 'pretty',
      prompts: 'false',
      pretty: true,
      includesPrompt: false,
    },
    {
      environment: 'development',
      format: 'pretty',
      prompts: 'false',
      pretty: true,
      includesPrompt: false,
    },
    {
      environment: 'production',
      format: 'json',
      prompts: 'true',
      pretty: false,
      includesPrompt: true,
    },
    {
      environment: 'development',
      format: 'invalid',
      prompts: 'invalid',
      pretty: true,
      includesPrompt: true,
    },
    {
      environment: 'production',
      format: 'invalid',
      prompts: 'invalid',
      pretty: false,
      includesPrompt: false,
    },
  ])(
    'formats $environment logs with format=$format and prompts=$prompts',
    ({ environment, format, prompts, pretty, includesPrompt }) => {
      vi.stubEnv('NODE_ENV', environment);
      vi.stubEnv('AI_LOG_FORMAT', format);
      vi.stubEnv('AI_LOG_PROMPTS', prompts);
      logAiEvent(
        'ai.trace.started',
        { originalMessageText: 'First line\nSecond line', metadata: { count: 1 } },
        root('a')
      );
      expect(console.info).toHaveBeenCalledTimes(1);
      const output = String(vi.mocked(console.info).mock.calls[0][0]);
      const record = JSON.parse(output);
      expect(record).toMatchObject({
        event: 'ai.trace.started',
        traceId: 'a',
        originMessageId: 'message-a',
        metadata: { count: 1 },
      });
      if (pretty) {
        expect(output).toContain('\n  "event": "ai.trace.started"');
        expect(output).toContain('\n    "count": 1\n  }');
      } else expect(output).not.toContain('\n');
      if (includesPrompt) expect(record.originalMessageText).toBe('First line\nSecond line');
      else {
        expect(record).not.toHaveProperty('originalMessageText');
        expect(output).not.toContain('First line');
      }
    }
  );

  it('logs only original input and retains the stored diagnostic payload unchanged', async () => {
    vi.stubEnv('AI_LOG_PROMPTS', 'true');
    const payload = {
      content: 'Original input',
      system: 'SYSTEM-SENTINEL',
      history: ['HISTORY-SENTINEL'],
      attachments: [{ text: 'ATTACHMENT-SENTINEL' }],
    };
    const context = await startAiTrace(root('a'), payload, payload.content);
    await withAiTrace(context, () =>
      traceAiOperation(
        'tool',
        'write',
        { instruction: 'TOOL-SENTINEL' },
        async () => 'OUTPUT-SENTINEL'
      )
    );
    expect(store.insertAiTrace).toHaveBeenCalledWith(expect.objectContaining({ prompt: payload }));
    expect(
      logRecords().filter(record => record.originalMessageText === payload.content)
    ).toHaveLength(1);
    for (const text of [
      'SYSTEM-SENTINEL',
      'HISTORY-SENTINEL',
      'ATTACHMENT-SENTINEL',
      'TOOL-SENTINEL',
      'OUTPUT-SENTINEL',
    ]) {
      expect(JSON.stringify(logRecords())).not.toContain(text);
    }
  });

  it('redacts credentials before either presentation format and never repeats original text in followup events', () => {
    vi.stubEnv('AI_LOG_PROMPTS', 'true');
    for (const format of ['pretty', 'json']) {
      vi.stubEnv('AI_LOG_FORMAT', format);
      logAiEvent(
        'ai.trace.started',
        {
          originalMessageText: 'Use sk-abcdefghijklmnop and Bearer abcdefghijklmnop',
          apiKey: 'api-secret',
          headers: { Authorization: 'header-secret' },
        },
        root('a')
      );
      logAiEvent('ai.model.started', { originalMessageText: 'SHOULD-NOT-REPEAT' }, root('a'));
    }
    const serialized = JSON.stringify(logRecords());
    for (const text of [
      'sk-abcdefghijklmnop',
      'Bearer abcdefghijklmnop',
      'api-secret',
      'header-secret',
      'SHOULD-NOT-REPEAT',
    ])
      expect(serialized).not.toContain(text);
    expect(logRecords().filter(record => record.event === 'ai.trace.started')).toEqual([
      expect.objectContaining({ originalMessageText: 'Use [redacted] and [redacted]' }),
      expect.objectContaining({ originalMessageText: 'Use [redacted] and [redacted]' }),
    ]);
  });

  it('keeps concurrent original prompts scoped to their own traces', async () => {
    vi.stubEnv('AI_LOG_PROMPTS', 'true');
    await Promise.all(
      ['chat', 'studio', 'city_design', 'amendment_text'].map(surface =>
        (async () => {
          const context = await startAiTrace(
            { ...root(surface), surface },
            { content: `Original ${surface}` },
            `Original ${surface}`
          );
          await withAiTrace(context, () =>
            traceAiOperation('tool', 'write', { content: 'Derived instruction' }, async () => {
              await Promise.resolve();
              return traceAiOperation(
                'model',
                'nested_generation',
                { content: 'Derived instruction' },
                async () => 'Result'
              );
            })
          );
        })()
      )
    );
    for (const surface of ['chat', 'studio', 'city_design', 'amendment_text']) {
      const records = logRecords().filter(record => record.traceId === surface);
      expect(records.filter(record => record.originalMessageText !== undefined)).toEqual([
        expect.objectContaining({
          event: 'ai.trace.started',
          originalMessageText: `Original ${surface}`,
        }),
      ]);
    }
  });

  it('emits one new start event for an explicit resume with the same lineage', async () => {
    vi.stubEnv('AI_LOG_PROMPTS', 'true');
    for (let request = 0; request < 2; request++) {
      const context = await startAiTrace(
        root('a'),
        { content: 'Original input' },
        'Original input'
      );
      await withAiTrace(context, () => traceAiOperation('model', 'chat', {}, async () => 'Result'));
    }
    expect(logRecords().filter(record => record.event === 'ai.trace.started')).toEqual([
      expect.objectContaining({
        traceId: 'a',
        originMessageId: 'message-a',
        originalMessageText: 'Original input',
      }),
      expect.objectContaining({
        traceId: 'a',
        originMessageId: 'message-a',
        originalMessageText: 'Original input',
      }),
    ]);
  });

  it('logs a start without guessing a prompt from system/history payloads', async () => {
    vi.stubEnv('AI_LOG_PROMPTS', 'true');
    await startAiTrace(root('a'), { messages: [{ role: 'system', content: 'SYSTEM-SENTINEL' }] });
    expect(logRecords()[0]).not.toHaveProperty('originalMessageText');
    expect(JSON.stringify(logRecords())).not.toContain('SYSTEM-SENTINEL');
  });
});

describe('AI lineage and safe diagnostics', () => {
  it('isolates simultaneous prompts and parents nested tool/model calls', async () => {
    await Promise.all(
      ['a', 'b'].map(id =>
        withAiTrace(root(id), () =>
          traceAiOperation(
            'tool',
            'studio_generate_suggestion',
            { instruction: id },
            async () => {
              const parent = currentAiTrace()?.operationId;
              await traceAiOperation('model', 'design', { prompt: id }, async () => {
                await Promise.resolve();
                return { text: `result-${id}` };
              });
              return { parent };
            },
            { toolCallId: `call-${id}` }
          )
        )
      )
    );
    const operations = store.insertAiOperation.mock.calls.map(([operation]) => operation);
    for (const id of ['a', 'b']) {
      const tool = operations.find(
        operation => operation.trace_id === id && operation.kind === 'tool'
      );
      const model = operations.find(
        operation => operation.trace_id === id && operation.kind === 'model'
      );
      expect(model.parent_operation_id).toBe(tool.id);
      expect(tool.tool_call_id).toBe(`call-${id}`);
    }
    expect(currentAiTrace()).toBeUndefined();
  });
  it('records embedded tool errors and does not emit prompt contents to logs', async () => {
    await withAiTrace(root('a'), () =>
      traceAiOperation('tool', 'write', { prompt: 'private content' }, async () => ({
        error: { code: 'validation_failed' },
      }))
    );
    expect(store.finishAiOperation).toHaveBeenCalledWith(
      expect.any(String),
      'failed',
      expect.anything(),
      expect.objectContaining({ code: 'validation_failed' }),
      expect.anything()
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private content');
  });
  it('finishes once and allows children of completed model operations', async () => {
    const parent = await startAiOperation('model', 'test', {}, {}, root('a'));
    await endAiOperation(parent, 'completed');
    await endAiOperation(parent, 'failed', null, new Error('duplicate'));
    if (!parent) throw new Error('Missing test context');
    await withAiTrace(parent, () => traceAiOperation('tool', 'read', {}, async () => 'result'));
    expect(store.finishAiOperation).toHaveBeenCalledTimes(2);
  });
  it('extracts provider cause, identifier failures and redacts credentials', () => {
    const error = normalizeAiError({
      statusCode: 429,
      responseBody: JSON.stringify({
        error: {
          metadata: {
            provider_name: 'Novita',
            limit_source: 'upstream_provider_shared_pool',
            raw: 'private content',
          },
        },
      }),
      requestBodyValues: { messages: ['private content'] },
    });
    expect(error).toMatchObject({
      code: 'ai_provider_rate_limited',
      provider: 'Novita',
      limitSource: 'upstream_provider_shared_pool',
    });
    expect(JSON.stringify(error)).not.toContain('private content');
    expect(normalizeAiError({ code: '22P02' })).toMatchObject({
      code: 'ai_invalid_identifier',
      sqlState: '22P02',
    });
    expect(
      redactAiValue({
        apiKey: 'secret',
        headers: { Authorization: 'secret' },
        prompt: 'sk-abcdefghijklmnop',
      })
    ).toEqual({ apiKey: '[redacted]', headers: '[redacted]', prompt: '[redacted]' });
  });
  it('reports storage failure without changing a successful tool result', async () => {
    store.insertAiOperation.mockRejectedValueOnce(new Error('storage unavailable'));
    expect(
      await withAiTrace(root('a'), () =>
        traceAiOperation('tool', 'write', {}, async () => ({ committed: true }))
      )
    ).toEqual({ committed: true });
  });
});

describe('provider rejection retries', () => {
  it('retries twice with the same body and preserves the trace', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response('accepted'));
    vi.stubGlobal('fetch', fetch);
    const context = await startAiTrace(root('a'), { content: 'Original input' }, 'Original input');
    const result = withAiTrace(context, () =>
      aiProviderFetch('https://provider.test', {
        body: '{"model":"same-model","messages":[]}',
        method: 'POST',
      })
    );
    await vi.runAllTimersAsync();
    expect((await result).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(new Set(fetch.mock.calls.map(([, init]) => init.body)).size).toBe(1);
    expect(store.insertAiOperation.mock.calls.map(([operation]) => operation.attempt)).toEqual([
      1, 2, 3,
    ]);
    expect(logRecords().filter(record => record.event === 'ai.trace.started')).toHaveLength(1);
    expect(
      logRecords()
        .filter(record => record.event === 'ai.provider.started')
        .map(record => record.traceId)
    ).toEqual(['a', 'a', 'a']);
  });
  it('does not retry accepted streams, billing failures or excessive Retry-After', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const response of [
      new Response('mid-stream failure'),
      new Response('{}', { status: 402 }),
      new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }),
    ]) {
      fetch.mockResolvedValueOnce(response);
      expect(await withAiTrace(root('a'), () => aiProviderFetch('https://provider.test'))).toBe(
        response
      );
    }
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(retryAfterMs('2', 0)).toBe(2000);
    expect(retryAfterMs('Thu, 01 Jan 1970 00:00:03 GMT', 0)).toBe(3000);
  });
  it('honors cancellation during backoff', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }));
    vi.stubGlobal('fetch', fetch);
    const abort = new AbortController();
    abort.abort();
    await expect(
      withAiTrace(root('a'), () =>
        aiProviderFetch('https://provider.test', { signal: abort.signal })
      )
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
