import type { ZeroContext } from '@/zero/context';
import { dbProvider } from '@/zero/db-provider';
import { encodeAppError, parseAppError } from '@/features/shared/errors/app-error';
import { GROUP_CONFLICT_ERROR_PREFIX } from '@/features/groups/logic/groupConflict';

export type ZeroTransaction = Parameters<Parameters<typeof dbProvider.transaction>[0]>[0];

interface ZeroMutatorRequest<TArgs> {
  readonly mutator: {
    readonly fn: (options: { tx: ZeroTransaction; ctx: ZeroContext; args: TArgs }) => Promise<void>;
  };
  readonly args: TArgs;
}

function messageFrom(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' ? message : null;
  }
  return null;
}

function isStructuredMutationMessage(message: string): boolean {
  return parseAppError(message) !== null || message.startsWith(GROUP_CONFLICT_ERROR_PREFIX);
}

function safeMutationMessage(value: unknown): string {
  const message = messageFrom(value);
  if (message && isStructuredMutationMessage(message)) return message;
  if (value != null) console.error('Unstructured Zero mutation error', value);
  return encodeAppError('mutation_server_failed');
}

/**
 * Zero serializes mutator failures into a nested result object. Sanitize that
 * boundary so legacy clear-text exceptions remain server logs and clients only
 * receive stable, localizable payloads.
 */
export function sanitizeZeroMutationResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeZeroMutationResult);
  if (!value || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    result[key] = sanitizeZeroMutationResult(child);
  }

  if (
    source.type === 'error' &&
    source.error &&
    typeof source.error === 'object' &&
    'message' in source.error
  ) {
    const error = source.error as Record<string, unknown>;
    result.error = {
      ...error,
      message: safeMutationMessage(error.message),
    };
  }

  return result;
}

export function createZeroContext(userID: string, email = ''): ZeroContext {
  return { userID, email };
}

export async function executeZeroTransaction<TResult>(
  ctx: ZeroContext,
  callback: (tx: ZeroTransaction, ctx: ZeroContext) => Promise<TResult>
): Promise<TResult> {
  return dbProvider.transaction(async tx => callback(tx, ctx));
}

export async function executeZeroRead<TResult>(
  callback: (tx: ZeroTransaction) => Promise<TResult>
): Promise<TResult> {
  return dbProvider.transaction(async tx => callback(tx));
}

export async function runZeroMutator<TArgs>(
  tx: ZeroTransaction,
  request: ZeroMutatorRequest<TArgs>,
  ctx: ZeroContext
): Promise<void> {
  try {
    await request.mutator.fn({ tx, ctx, args: request.args });
  } catch (error) {
    const message = safeMutationMessage(error);
    if (error instanceof Error && error.message === message) throw error;
    throw new Error(message, { cause: error });
  }
}

export async function executeZeroMutator<TArgs>(
  request: ZeroMutatorRequest<TArgs>,
  ctx: ZeroContext
): Promise<void> {
  await executeZeroTransaction(ctx, async tx => {
    await runZeroMutator(tx, request, ctx);
  });
}
