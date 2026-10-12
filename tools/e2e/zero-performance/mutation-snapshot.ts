import assert from 'node:assert/strict';

interface SnapshotClient {
  clientID: string;
  inspector: { client: { map(): Promise<Map<string, unknown>> } };
}

/** Public Inspector reads the rebased local store, not the HTTP acknowledgement.
 * Zero 1.9 replicates error responses under m/<clientID>/<id>. A fresh writer
 * runs exactly one subject mutation. A missing/transient marker fails closed.
 * Values are never logged: they can contain application error details.
 */
export function watchMutationSnapshot(writer: SnapshotClient) {
  const diagnostics: { state: 'missing-marker' | 'map-rejected' | 'invalid-response' | 'applied' } =
    { state: 'missing-marker' };
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish!: (value: { mutationID: number; at: number } | undefined) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<{ mutationID: number; at: number } | undefined>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  // Attach a rejection handler immediately; the caller awaits after server ACK.
  void promise.catch(() => undefined);
  const prefix = `m/${writer.clientID}/`;
  const poll = async () => {
    try {
      let map;
      try {
        map = await writer.inspector.client.map();
      } catch (error) {
        diagnostics.state = 'map-rejected';
        throw error;
      }
      if (stopped) return;
      const ids = [...map.keys()]
        .filter(key => key.startsWith(prefix))
        .map(key => Number(key.slice(prefix.length)));
      if (ids.length) {
        diagnostics.state = 'invalid-response';
        assert.equal(ids.length, 1, 'Fresh writer has ambiguous replicated mutation responses');
        assert.ok(
          Number.isSafeInteger(ids[0]) && ids[0] > 0,
          'Invalid replicated mutation identity'
        );
        stopped = true;
        diagnostics.state = 'applied';
        finish({ mutationID: ids[0], at: performance.now() });
        return;
      }
      timer = setTimeout(() => {
        void poll();
      }, 5);
    } catch (error) {
      stopped = true;
      fail(error);
    }
  };
  void poll();
  return {
    diagnostics,
    promise,
    cancel() {
      stopped = true;
      clearTimeout(timer);
      finish(undefined);
    },
  };
}

/** Await a rebase-driven view update; an early HTTP ACK cannot satisfy it. */
export async function waitForRollback(read: () => unknown, baseline: unknown, timeoutMs = 15_000) {
  const until = performance.now() + timeoutMs;
  while (true) {
    try {
      assert.deepEqual(structuredClone(read()), baseline);
      return;
    } catch {
      if (performance.now() >= until) throw new Error('Optimistic write was not rolled back');
      await new Promise<void>(resolve => setTimeout(resolve, 5));
    }
  }
}

/** These two factories provide only fresh Inspector and SQL reads. Keep their
 * revision-owned assertions intact while awaiting asynchronous authority eviction.
 * Other rollback callbacks may have side effects and must run exactly once.
 */
export async function waitForReadOnlyRollbackProof(
  variant: string,
  verify: () => Promise<void>,
  timeoutMs = 15_000
) {
  if (
    variant !== 'delegated-authority-revoked-after-preload' &&
    variant !== 'secret-manager-authority-revoked-after-preload'
  ) {
    await verify();
    return;
  }
  let stopped = false;
  let lastMismatch: assert.AssertionError | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let resumePoll: (() => void) | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const verification = async () => {
    while (!stopped) {
      try {
        await verify();
        return;
      } catch (error) {
        if (stopped) return;
        if (
          !(error instanceof assert.AssertionError) ||
          !/^Rollback (row|field) proof: [A-Za-z_]+(?:\.[A-Za-z_]+)?$/.test(
            error.message.split('\n')[0]
          )
        )
          throw error;
        lastMismatch = error;
        await new Promise<void>(resolve => {
          resumePoll = resolve;
          pollTimer = setTimeout(resolve, 5);
        });
      }
    }
  };
  try {
    await Promise.race([
      verification(),
      new Promise<never>((_, reject) => {
        deadlineTimer = setTimeout(() => {
          stopped = true;
          reject(lastMismatch ?? new Error('Read-only rollback verification timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    stopped = true;
    clearTimeout(deadlineTimer);
    clearTimeout(pollTimer);
    resumePoll?.();
  }
}
