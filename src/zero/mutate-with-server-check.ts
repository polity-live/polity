import {
  GroupConflictError,
  parseGroupConflictResponseMessage,
} from '@/features/groups/logic/groupConflict';
import { localizeAppError } from '@/features/shared/errors';

/**
 * Utilities for Zero mutation server interaction.
 *
 * `zero.mutate(...)` returns `{ client: Promise, server: Promise }` — NOT a
 * plain Promise. When code does `await zero.mutate(...)`, JavaScript resolves
 * immediately because the return value is not thenable. The `.server` promise
 * must be explicitly awaited to detect server-side rejections.
 */

export interface MutationResultLike {
  client?: Promise<unknown>;
  server: Promise<{
    readonly type: 'success' | 'error';
    readonly error?: {
      readonly type: string;
      readonly message: string;
    };
  }>;
}

interface TrackServerFinalizationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  ignoreZeroClosed?: boolean;
}

const ZERO_CLOSED_MESSAGE = 'Zero was explicitly closed by calling zero.close()';
const RETRYABLE_SERVER_MUTATION_MESSAGES = [
  'deadlock detected',
  'could not serialize access',
  'serialization failure',
] as const;

export function isZeroClosedMutationCancellation(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes(ZERO_CLOSED_MESSAGE);
  }

  if (value instanceof Error) {
    return value.message.includes(ZERO_CLOSED_MESSAGE);
  }

  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' && message.includes(ZERO_CLOSED_MESSAGE);
  }

  return false;
}

export async function waitForClientApply(result: MutationResultLike): Promise<void> {
  await (result.client ?? Promise.resolve());
}

/**
 * Await authoritative server confirmation of a Zero mutation.
 * Throws an `Error` whose message comes from the server rejection.
 *
 * Use this only when the next step depends on server acceptance, such as
 * password verification or a true authorization gate. For normal reactive UI,
 * await `waitForClientApply(result)` and monitor the server in the background.
 *
 * @example
 * ```ts
 * const result = zero.mutate(mutators.foo.bar(args));
 * await serverConfirmed(result);
 * toast.success('Done!');
 * ```
 */
export async function serverConfirmed(result: MutationResultLike): Promise<void> {
  const serverResult = await result.server;
  if (serverResult.type === 'error') {
    throw toMutationError(serverResult.error?.message);
  }
}

export function isRetryableServerMutationError(value: unknown): boolean {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : value && typeof value === 'object' && 'message' in value
          ? String((value as { message?: unknown }).message ?? '')
          : '';
  const normalized = message.toLowerCase();
  return RETRYABLE_SERVER_MUTATION_MESSAGES.some(candidate => normalized.includes(candidate));
}

export function trackServerFinalization(
  result: MutationResultLike,
  options: TrackServerFinalizationOptions = {}
): void {
  result.server
    .then(serverResult => {
      if (serverResult.type === 'success') {
        options.onSuccess?.();
        return;
      }

      options.onError?.(toMutationError(serverResult.error?.message));
    })
    .catch((err: unknown) => {
      if (options.ignoreZeroClosed && isZeroClosedMutationCancellation(err)) {
        return;
      }

      options.onError?.(err instanceof Error ? err : toMutationError(null));
    });
}

/**
 * Fire-and-forget background error monitor for a Zero mutation.
 * The mutation is applied optimistically on the client. If the server
 * later rejects it, `onError` is called with the error message so the
 * caller can show a toast or other feedback.
 *
 * This function is **synchronous** — it does NOT block. It schedules
 * a background `.server` listener and returns immediately.
 *
 * @example
 * ```ts
 * const result = zero.mutate(mutators.foo.bar(args));
 * toast.success('Done!');
 * onServerError(result, (msg) => toast.error(msg));
 * ```
 */
export function onServerError(
  result: MutationResultLike,
  onError: (message: string) => void
): void {
  result.server
    .then(serverResult => {
      if (serverResult.type === 'error') {
        const rawMessage = serverResult.error?.message;
        if (rawMessage) console.error('Zero server mutation failed', rawMessage);
        onError(localizeAppError(toMutationError(rawMessage), { logUnknown: false }));
      }
    })
    .catch((err: unknown) => {
      console.error('Zero server mutation failed', err);
      onError(localizeAppError(err, { logUnknown: false }));
    });
}

export function toMutationError(message: string | null | undefined): Error {
  const conflictResponse = parseGroupConflictResponseMessage(message);
  if (conflictResponse) {
    return new GroupConflictError(conflictResponse);
  }

  return new Error(message ?? 'Mutation failed on server');
}
