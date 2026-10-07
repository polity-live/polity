import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';
import { tool, stepCountIs } from 'ai';
import { z } from 'zod';
const store = vi.hoisted(() => ({
  insertAiOperation: vi.fn(),
  finishAiOperation: vi.fn(),
  insertAiTrace: vi.fn(),
}));
vi.mock('../ai-trace-store', () => store);
import { generateText, streamText } from '../ai-generation';
import { withAiTrace } from '../ai-trace';
import { aiProviderFetch } from '../ai-provider-fetch';

const root = {
  traceId: crypto.randomUUID(),
  actorId: crypto.randomUUID(),
  surface: 'city_design',
  invocation: 'project_chat',
};
const usage = {
  inputTokens: { total: 4, noCache: 4, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 2, text: 2, reasoning: 0 },
};
const generated = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage,
  warnings: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('parents actual SDK provider requests to the corresponding model step', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('accepted')));
  const model = new MockLanguageModelV4({
    modelId: 'provider-model',
    doGenerate: async () => {
      await aiProviderFetch('https://provider.test', {
        method: 'POST',
        body: '{"model":"provider-model","messages":[{"role":"user","content":"Original prompt"}]}',
      });
      return generated('Done');
    },
  });
  await withAiTrace(root, () => generateText({ model, prompt: 'Original prompt', maxRetries: 0 }));
  const operations = store.insertAiOperation.mock.calls.map(([operation]) => operation);
  expect(operations.find(operation => operation.kind === 'provider').parent_operation_id).toBe(
    operations.find(operation => operation.kind === 'model').id
  );
});

it('uses actual SDK callbacks to link model → tool → nested model and final answer', async () => {
  const model = new MockLanguageModelV4({
    modelId: 'chat',
    doGenerate: [
      {
        ...generated(''),
        content: [
          {
            type: 'tool-call',
            toolCallId: 'design-1',
            toolName: 'design',
            input: '{"instruction":"Post"}',
          },
        ],
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
      },
      generated('Created'),
    ],
  });
  const nested = new MockLanguageModelV4({
    modelId: 'design-model',
    doGenerate: generated('Plan'),
  });
  const result = await withAiTrace(root, () =>
    generateText({
      model,
      prompt: 'Make a post',
      stopWhen: stepCountIs(2),
      maxRetries: 0,
      tools: {
        design: tool({
          inputSchema: z.object({ instruction: z.string() }),
          execute: async ({ instruction }) => {
            const result = await generateText({
              model: nested,
              prompt: instruction,
              maxRetries: 0,
            });
            return { plan: result.text };
          },
        }),
      },
    })
  );
  expect(result.text).toBe('Created');
  const operations = store.insertAiOperation.mock.calls.map(([operation]) => operation);
  const chat = operations.find(operation => operation.name === 'chat');
  const toolCall = operations.find(operation => operation.name === 'design');
  const design = operations.find(operation => operation.name === 'design-model');
  expect(toolCall).toMatchObject({ tool_call_id: 'design-1', parent_operation_id: chat.id });
  expect(design.parent_operation_id).toBe(toolCall.id);
  expect(operations.filter(operation => operation.name === 'chat')).toHaveLength(2);
  expect(store.finishAiOperation).toHaveBeenCalledWith(
    design.id,
    'completed',
    expect.objectContaining({ text: 'Plan' }),
    undefined,
    expect.anything()
  );
});

it('records invalid tool input without executing a write', async () => {
  const execute = vi.fn();
  const model = new MockLanguageModelV4({
    modelId: 'chat',
    doGenerate: {
      ...generated(''),
      content: [{ type: 'tool-call', toolCallId: 'bad-1', toolName: 'write', input: '{"id":""}' }],
    },
  });
  await withAiTrace(root, () =>
    generateText({
      model,
      prompt: 'Write',
      maxRetries: 0,
      tools: { write: tool({ inputSchema: z.object({ id: z.string().uuid() }), execute }) },
    })
  );
  expect(execute).not.toHaveBeenCalled();
  const operation = store.insertAiOperation.mock.calls
    .map(([operation]) => operation)
    .find(operation => operation.tool_call_id === 'bad-1');
  expect(operation).toMatchObject({ name: 'write', metadata: { phase: 'input_validation' } });
  expect(store.finishAiOperation).toHaveBeenCalledWith(
    operation.id,
    'failed',
    undefined,
    expect.anything(),
    expect.anything()
  );
});

it('records accepted-stream errors without leaking the raw exception to console', async () => {
  const model = new MockLanguageModelV4({
    modelId: 'stream',
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'error', error: new Error('private prompt sk-abcdefghijklmnop') },
      ]),
    },
  });
  const result = withAiTrace(root, () =>
    streamText({ model, prompt: 'Private user prompt', maxRetries: 0 })
  );
  for await (const _part of result.fullStream) {
    /* Consume actual SDK pipeline. */
  }
  expect(store.finishAiOperation).toHaveBeenCalledWith(
    expect.any(String),
    'failed',
    undefined,
    expect.anything(),
    expect.anything()
  );
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private prompt');
});

it('retains generation behavior without tracing or diagnostic storage', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: generated('Plain'),
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'plain' },
        { type: 'text-delta', id: 'plain', delta: 'Plain' },
        { type: 'text-end', id: 'plain' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
      ]),
    },
  });
  expect((await generateText({ model, prompt: 'Read', maxRetries: 0 })).text).toBe('Plain');
  expect(await streamText({ model, prompt: 'Read', maxRetries: 0 }).text).toBe('Plain');
  expect(store.insertAiOperation).not.toHaveBeenCalled();
});

it('executes caller completion callbacks in a persistence operation after actual SDK generation', async () => {
  const model = new MockLanguageModelV4({ doGenerate: generated('Done') });
  const onStepStart = vi.fn(),
    onStepEnd = vi.fn(),
    onEnd = vi.fn();
  expect(
    (
      await withAiTrace(root, () =>
        generateText({ model, prompt: 'Read', maxRetries: 0, onStepStart, onStepEnd, onEnd })
      )
    ).text
  ).toBe('Done');
  expect(onStepStart).toHaveBeenCalledOnce();
  expect(onStepEnd).toHaveBeenCalledOnce();
  expect(onEnd).toHaveBeenCalledOnce();
  expect(store.insertAiOperation.mock.calls.map(([op]) => op.name)).toContain('finish_response');
});

it('supports SDK callback aliases while recording the actual current step context', async () => {
  const model = new MockLanguageModelV4({ doGenerate: generated('Done') });
  const onStepStart = vi.fn(),
    onStepFinish = vi.fn(),
    onFinish = vi.fn();
  const result = await withAiTrace(root, () =>
    generateText({
      model,
      prompt: 'Read',
      maxRetries: 0,
      experimental_onStepStart: onStepStart,
      onStepFinish,
      onFinish,
    })
  );
  expect(result.text).toBe('Done');
  expect(onStepStart).toHaveBeenCalledOnce();
  expect(onStepFinish).toHaveBeenCalledOnce();
  expect(onFinish).toHaveBeenCalledOnce();
});

it('records thrown provider failures and forwards the caller error callback without exposing raw console errors', async () => {
  const error = new Error('Provider unavailable');
  const onError = vi.fn();
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw error;
    },
  });
  await expect(
    withAiTrace(root, () =>
      generateText({ model, prompt: 'Read', maxRetries: 0, onError } as never)
    )
  ).rejects.toBe(error);
  expect(onError).toHaveBeenCalledWith({ error });
  expect(store.finishAiOperation).toHaveBeenCalledWith(
    expect.any(String),
    'failed',
    undefined,
    expect.anything(),
    expect.anything()
  );
});

it('records an aborted actual SDK stream and forwards cancellation without claiming completion', async () => {
  const abort = new AbortController();
  const onAbort = vi.fn();
  const model = new MockLanguageModelV4({
    doStream: async options => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'stop' });
          controller.enqueue({ type: 'text-delta', id: 'stop', delta: 'Partial' });
          options.abortSignal!.addEventListener(
            'abort',
            () => controller.error(new DOMException('Stopped', 'AbortError')),
            { once: true }
          );
        },
      }),
    }),
  });
  const result = withAiTrace(root, () =>
    streamText({ model, prompt: 'Read', maxRetries: 0, abortSignal: abort.signal, onAbort })
  );
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') abort.abort();
  }
  expect(onAbort).toHaveBeenCalledOnce();
  expect(store.finishAiOperation).toHaveBeenCalledWith(
    expect.any(String),
    'cancelled',
    undefined,
    undefined,
    expect.anything()
  );
});

it('advertises a caller-executed tool without inventing an executed tool operation', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: {
      ...generated(''),
      content: [
        { type: 'tool-call', toolCallId: 'external', toolName: 'read', input: '{"id":"project"}' },
      ],
      finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
    },
  });
  const result = await withAiTrace(root, () =>
    generateText({
      model,
      prompt: 'Read',
      maxRetries: 0,
      tools: { read: tool({ inputSchema: z.object({ id: z.string() }) }) },
    })
  );
  expect(result.toolCalls).toEqual([
    expect.objectContaining({ toolCallId: 'external', toolName: 'read', input: { id: 'project' } }),
  ]);
  expect(store.insertAiOperation.mock.calls.map(([op]) => op.kind)).toEqual(['model']);
});
