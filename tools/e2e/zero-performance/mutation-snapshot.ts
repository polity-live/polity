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
      const map = await writer.inspector.client.map();
      if (stopped) return;
      const ids = [...map.keys()]
        .filter(key => key.startsWith(prefix))
        .map(key => Number(key.slice(prefix.length)));
      if (ids.length) {
        assert.equal(ids.length, 1, 'Fresh writer has ambiguous replicated mutation responses');
        assert.ok(
          Number.isSafeInteger(ids[0]) && ids[0] > 0,
          'Invalid replicated mutation identity'
        );
        stopped = true;
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
