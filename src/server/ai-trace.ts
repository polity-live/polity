import { AsyncLocalStorage } from 'node:async_hooks';
import { aiErrorCode } from '@/lib/ai/errors';
import type { AiTraceOperation } from '@/lib/ai/trace';
import { insertAiTrace, insertAiOperation, finishAiOperation } from './ai-trace-store';

export interface AiTraceContext {
  traceId: string;
  actorId: string;
  originMessageId?: string;
  conversationId?: string;
  runId?: string;
  surface: string;
  invocation: string;
  studioProjectId?: string;
  amendmentId?: string;
  documentId?: string;
  operationId?: string;
  retryProvider?: boolean;
  model?: { provider: string; id: string; source?: string };
  modelContext?: () => AiTraceContext | undefined;
  latestModelOperation?: AiTraceContext;
  terminal?: boolean;
}
const storage = new AsyncLocalStorage<AiTraceContext>();
export const currentAiTrace = () => storage.getStore();
export const withAiTrace = <T>(context: AiTraceContext, work: () => T): T =>
  storage.run(context, work);

const secretKey =
  /^(authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|encrypted[_-]?key|password|secret|headers)$/i;
/** Diagnostics retain content, but never provider credentials or request headers. */
export function redactAiValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string')
    return value.replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/gi,
      '[redacted]'
    );
  if (!value || typeof value !== 'object') return typeof value === 'function' ? undefined : value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map(item => redactAiValue(item, seen))
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          secretKey.test(key) ? '[redacted]' : redactAiValue(item, seen),
        ])
      );
  seen.delete(value);
  return result;
}

export function normalizeAiError(error: unknown): Record<string, unknown> {
  const chain: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  let item = error;
  while (item && typeof item === 'object' && !seen.has(item)) {
    seen.add(item);
    const value = item as Record<string, unknown>;
    chain.push(value);
    item = value.cause;
  }
  const value = chain.find(item => item.statusCode || item.code || item.status) ?? chain[0] ?? {};
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(String(value.responseBody ?? '{}')).error ?? {};
  } catch {
    /* Non-JSON upstream body. */
  }
  const metadata = (body.metadata ?? {}) as Record<string, unknown>;
  const status = value.statusCode ?? value.status ?? body.code;
  const validation = chain.find(item => Array.isArray(item.issues));
  const code =
    status === 429
      ? 'ai_provider_rate_limited'
      : value.code === '22P02'
        ? 'ai_invalid_identifier'
        : validation ||
            chain.some(item => /InvalidToolInput|TypeValidation|NoSuchTool/.test(String(item.name)))
          ? 'validation_failed'
          : typeof value.code === 'string' && /^[a-z_]+$/.test(value.code)
            ? value.code
            : aiErrorCode(error);
  return {
    version: 1,
    code,
    name: typeof chain[0]?.name === 'string' ? chain[0].name : undefined,
    httpStatus: typeof status === 'number' ? status : undefined,
    sqlState:
      typeof value.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code) ? value.code : undefined,
    provider: metadata.provider_name,
    limitSource: metadata.limit_source,
    generationId: (value.responseHeaders as Record<string, unknown> | undefined)?.[
      'x-generation-id'
    ],
    retryable: status === 429,
    recovery:
      status === 429
        ? 'retry_later'
        : value.code === '22P02'
          ? 'check_identifier'
          : 'inspect_trace',
    // Exception messages may embed prompts or SQL. Keep only validation paths.
    fields: validation
      ? (validation.issues as { path?: unknown }[]).map(issue => issue.path)
      : undefined,
    ...(process.env.AI_LOG_LEVEL === 'debug' && typeof value.stack === 'string'
      ? {
          stack: redactAiValue(
            value.stack
              .split('\n')
              .filter(line => /^\s*at /.test(line))
              .slice(0, 20)
              .join('\n')
          ),
        }
      : {}),
  };
}

export function logAiEvent(
  event: string,
  details: Record<string, unknown> = {},
  context = currentAiTrace()
) {
  const level = event.endsWith('failed') ? 'error' : event.includes('retry') ? 'warn' : 'info';
  const production = process.env.NODE_ENV === 'production';
  const pretty =
    process.env.AI_LOG_FORMAT === 'pretty'
      ? true
      : process.env.AI_LOG_FORMAT === 'json'
        ? false
        : !production;
  const includePrompts =
    process.env.AI_LOG_PROMPTS === 'true'
      ? true
      : process.env.AI_LOG_PROMPTS === 'false'
        ? false
        : !production;
  const { originalMessageText, ...summary } = details;
  const record = redactAiValue({
    time: new Date().toISOString(),
    level,
    event,
    traceId: context?.traceId,
    originMessageId: context?.originMessageId,
    conversationId: context?.conversationId,
    runId: context?.runId,
    operationId: context?.operationId,
    surface: context?.surface,
    invocation: context?.invocation,
    modelProvider: context?.model?.provider,
    modelId: context?.model?.id,
    modelSource: context?.model?.source,
    ...summary,
    ...(event === 'ai.trace.started' && includePrompts && typeof originalMessageText === 'string'
      ? { originalMessageText }
      : {}),
  }) as Record<string, unknown>;
  const output = JSON.stringify(record, null, pretty ? 2 : undefined);
  console[level](output);
}

// Logging cannot turn an already committed business operation into a failure.
// Missing migration/storage is reported explicitly, never printed with payloads.
export async function persistAiDiagnostic(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    logAiEvent('ai.diagnostics.failed', normalizeAiError(error));
  }
}

export async function startAiTrace(
  context: AiTraceContext,
  prompt: unknown,
  originalMessageText?: string
) {
  logAiEvent('ai.trace.started', { originalMessageText }, context);
  await persistAiDiagnostic(() =>
    insertAiTrace({ id: context.traceId, ...context, prompt: redactAiValue(prompt) })
  );
  return context;
}

export async function startAiOperation(
  kind: string,
  name: string,
  input: unknown,
  options: { toolCallId?: string; attempt?: number; metadata?: Record<string, unknown> } = {},
  context = currentAiTrace()
) {
  if (!context) return undefined;
  const operation: AiTraceOperation = {
    id: crypto.randomUUID(),
    trace_id: context.traceId,
    parent_operation_id: context.operationId ?? null,
    kind,
    name,
    status: 'running',
    tool_call_id: options.toolCallId ?? null,
    attempt: options.attempt ?? 1,
    input: redactAiValue(input),
    output: null,
    error: null,
    metadata: redactAiValue(options.metadata ?? {}) as Record<string, unknown>,
    created_at: Date.now(),
    finished_at: null,
  };
  await persistAiDiagnostic(() => insertAiOperation(operation));
  logAiEvent(
    `ai.${kind}.started`,
    { name, toolCallId: options.toolCallId, attempt: operation.attempt },
    { ...context, operationId: operation.id }
  );
  return { ...context, operationId: operation.id, terminal: false };
}

export async function endAiOperation(
  context: AiTraceContext | undefined,
  status: string,
  output?: unknown,
  error?: unknown,
  metadata: Record<string, unknown> = {}
) {
  if (!context?.operationId || context.terminal) return;
  context.terminal = true;
  const operationId = context.operationId;
  const safe = error ? normalizeAiError(error) : undefined;
  await persistAiDiagnostic(() =>
    finishAiOperation(operationId, status, redactAiValue(output), safe, redactAiValue(metadata))
  );
  logAiEvent(`ai.operation.${status}`, { ...metadata, ...safe }, context);
}

export async function traceAiOperation<T>(
  kind: string,
  name: string,
  input: unknown,
  work: () => Promise<T>,
  options: { toolCallId?: string } = {}
) {
  const context = await startAiOperation(kind, name, input, options);
  const execute = async () => {
    try {
      const output = await work();
      const value = output as { error?: unknown; status?: string } | null;
      await endAiOperation(
        context,
        value?.error ? 'failed' : value?.status === 'queued' ? 'queued' : 'completed',
        output,
        value?.error
      );
      return output;
    } catch (error) {
      await endAiOperation(
        context,
        (error as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed',
        undefined,
        error
      );
      throw error;
    }
  };
  return context ? withAiTrace(context, execute) : execute();
}

/** Records setup failures and attaches lineage even to early HTTP responses. */
export async function traceAiRequest(context: AiTraceContext, work: () => Promise<Response>) {
  return withAiTrace(context, async () => {
    const operation = await startAiOperation('request', context.invocation, undefined);
    try {
      const response = await work();
      const error = response.ok
        ? undefined
        : await response
            .clone()
            .json()
            .catch(() => ({}));
      const output =
        response.ok && response.headers.get('Content-Type')?.includes('application/json')
          ? await response
              .clone()
              .json()
              .catch(() => undefined)
          : undefined;
      await endAiOperation(
        operation,
        response.ok ? 'completed' : 'failed',
        output,
        (error as { error?: unknown })?.error,
        { httpStatus: response.status }
      );
      response.headers.set('X-AI-Trace-Id', context.traceId);
      return response;
    } catch (error) {
      await endAiOperation(operation, 'failed', undefined, error);
      throw error;
    }
  });
}
