import {
  GroupConflictError,
  parseGroupConflictResponseMessage,
} from '@/features/groups/logic/groupConflict';

/**
 * Utilities for Zero mutation server interaction.
 *
 * `zero.mutate(...)` returns `{ client: Promise, server: Promise }` — NOT a
 * plain Promise. When code does `await zero.mutate(...)`, JavaScript resolves
 * immediately because the return value is not thenable. The `.server` promise
 * must be explicitly awaited to detect server-side rejections.
 */

interface MutationResultLike {
  server: Promise<{
    readonly type: 'success' | 'error';
    readonly error?: {
      readonly type: string;
      readonly message: string;
    };
  }>;
}

/**
 * Await server confirmation of a Zero mutation.
 * Throws an `Error` whose message comes from the server rejection.
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
        onError(serverResult.error?.message ?? 'Mutation failed on server');
      }
    })
    .catch((err: unknown) => {
      onError(err instanceof Error ? err.message : 'Mutation failed on server');
    });
}

export function toMutationError(message: string | null | undefined): Error {
  const conflictResponse = parseGroupConflictResponseMessage(message);
  if (conflictResponse) {
    return new GroupConflictError(conflictResponse);
  }

  return new Error(message ?? 'Mutation failed on server');
}
