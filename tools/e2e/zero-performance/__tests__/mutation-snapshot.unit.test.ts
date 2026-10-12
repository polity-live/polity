import { afterEach, describe, expect, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import {
  waitForRollback,
  waitForReadOnlyRollbackProof,
  watchMutationSnapshot,
} from '../mutation-snapshot';

afterEach(() => vi.useRealTimers());
describe('mutation snapshot and rollback proof', () => {
  it('requires a replicated response for the writing client, not an HTTP ACK', async () => {
    vi.useFakeTimers();
    const map = new Map<string, unknown>([['m/other-client/1', {}]]);
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: { client: { map: async () => map } },
    });
    let settled = false;
    void watcher.promise.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(settled).toBe(false);
    expect(watcher.diagnostics.state).toBe('missing-marker');
    map.set('m/writer/1', { error: 'app', message: 'private fixture content' });
    await vi.advanceTimersByTimeAsync(5);
    expect(await watcher.promise).toEqual({ mutationID: 1, at: expect.any(Number) });
    expect(watcher.diagnostics.state).toBe('applied');
  });
  it('rejects ambiguous responses in a purported fresh writer', async () => {
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: {
        client: {
          map: async () =>
            new Map([
              ['m/writer/1', {}],
              ['m/writer/2', {}],
            ]),
        },
      },
    });
    await expect(watcher.promise).rejects.toThrow('ambiguous');
    expect(watcher.diagnostics.state).toBe('invalid-response');
  });
  it('distinguishes inspector map rejection without exporting its private error', async () => {
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: {
        client: {
          map: async () => {
            throw new Error('private map error');
          },
        },
      },
    });
    await expect(watcher.promise).rejects.toThrow('private map error');
    expect(watcher.diagnostics).toEqual({ state: 'map-rejected' });
    expect(JSON.stringify(watcher.diagnostics)).not.toContain('private');
  });
  it('cancels unresolved polling without leaking a timer', async () => {
    vi.useFakeTimers();
    const map = vi.fn(async () => new Map<string, unknown>());
    const watcher = watchMutationSnapshot({ clientID: 'writer', inspector: { client: { map } } });
    await vi.advanceTimersByTimeAsync(5);
    watcher.cancel();
    const calls = map.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(map).toHaveBeenCalledTimes(calls);
    expect(await watcher.promise).toBeUndefined();
  });
  it('does not inspect a pending map result after the watcher was cancelled', async () => {
    let resolveMap!: (value: Map<string, unknown>) => void;
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: {
        client: {
          map: () =>
            new Promise(resolve => {
              resolveMap = resolve;
            }),
        },
      },
    });
    watcher.cancel();
    resolveMap(new Map([['m/writer/1', {}]]));
    await expect(watcher.promise).resolves.toBeUndefined();
    expect(watcher.diagnostics.state).toBe('missing-marker');
  });
  it('waits for optimistic rollback after a delayed server snapshot', async () => {
    vi.useFakeTimers();
    let state = { title: 'optimistic' };
    let proved = false;
    const proof = waitForRollback(() => state, { title: 'original' }).then(() => {
      proved = true;
    });
    await vi.advanceTimersByTimeAsync(15);
    expect(proved).toBe(false);
    state = { title: 'original' };
    await vi.advanceTimersByTimeAsync(5);
    await proof;
    expect(proved).toBe(true);
  });
  it('compares complete business data without Zero bookkeeping symbols or object prototypes', async () => {
    const state = Object.assign(Object.create(null), {
      title: 'original',
      relations: [{ id: 'child' }],
      [Symbol('rc')]: 1,
    });
    await expect(waitForRollback(() => state, structuredClone(state), 20)).resolves.toBeUndefined();
    vi.useFakeTimers();
    const changed = Object.assign(Object.create(null), {
      title: 'original',
      relations: [{ id: 'changed' }],
    });
    const proof = waitForRollback(() => changed, structuredClone(state), 20);
    const assertion = expect(proof).rejects.toThrow('not rolled back');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });
  it('fails if a rejected optimistic change remains', async () => {
    vi.useFakeTimers();
    const proof = waitForRollback(() => ({ title: 'optimistic' }), { title: 'original' }, 20);
    const assertion = expect(proof).rejects.toThrow('not rolled back');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });
});

describe('revision-owned read-only SQL rollback proofs', () => {
  const delegated = 'delegated-authority-revoked-after-preload';
  const mismatch = (label: string) =>
    new assert.AssertionError({ message: label, actual: 0, expected: 1, operator: 'strictEqual' });

  it.each([delegated, 'secret-manager-authority-revoked-after-preload'])(
    'awaits fresh cache eviction and unchanged SQL equality for %s',
    async variant => {
      vi.useFakeTimers();
      let cached = new Map([['deleted-right', { id: 'deleted-right' }]]);
      const map = vi.fn(async () => cached);
      const sql = vi.fn(async () => []);
      const verify = vi.fn(async () => {
        for (const _row of (await map()).values())
          assert.equal((await sql()).length, 1, 'Rollback row proof: action_right');
      });
      const proof = waitForReadOnlyRollbackProof(variant, verify);
      await vi.advanceTimersByTimeAsync(10);
      expect(verify).toHaveBeenCalledTimes(3);
      expect(sql).toHaveBeenCalledTimes(3);
      cached = new Map();
      await vi.advanceTimersByTimeAsync(5);
      await proof;
      expect(map).toHaveBeenCalledTimes(4);
      expect(vi.getTimerCount()).toBe(0);
    }
  );
  it('rechecks complete field equality rather than accepting a still-present row', async () => {
    vi.useFakeTimers();
    let actual = 'optimistic';
    const verify = vi.fn(async () =>
      assert.deepEqual(actual, 'original', 'Rollback field proof: vote.status')
    );
    const proof = waitForReadOnlyRollbackProof(delegated, verify);
    await vi.advanceTimersByTimeAsync(10);
    actual = 'original';
    await vi.advanceTimersByTimeAsync(5);
    await proof;
    expect(verify).toHaveBeenCalledTimes(4);
  });
  it('fails at the original deadline with the last exact SQL assertion', async () => {
    vi.useFakeTimers();
    const error = mismatch('Rollback row proof: action_right');
    const verify = vi.fn(async () => {
      throw error;
    });
    const proof = waitForReadOnlyRollbackProof(delegated, verify, 13);
    const rejected = expect(proof).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(13);
    await rejected;
    expect(verify).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([
    new Error('Rollback row proof: action_right'),
    mismatch('Invalid cached application row'),
    Object.assign(new Error('database unavailable'), { code: '08006' }),
  ])(
    'never retries malformed data or failures outside the original SQL assertions',
    async error => {
      const verify = vi.fn(async () => {
        throw error;
      });
      await expect(waitForReadOnlyRollbackProof(delegated, verify)).rejects.toBe(error);
      expect(verify).toHaveBeenCalledOnce();
    }
  );
  it('calls unrelated rollback functions once even when they throw a matching assertion', async () => {
    const error = mismatch('Rollback row proof: action_right');
    const verify = vi.fn(async () => {
      throw error;
    });
    await expect(waitForReadOnlyRollbackProof('authorized', verify)).rejects.toBe(error);
    expect(verify).toHaveBeenCalledOnce();
    await expect(
      waitForReadOnlyRollbackProof('authorized', async () => undefined)
    ).resolves.toBeUndefined();
  });
  it('does not extend the shared deadline around a revision-owned inner wait', async () => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const verify = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        })
    );
    const proof = waitForReadOnlyRollbackProof(delegated, verify, 13);
    const rejected = expect(proof).rejects.toThrow('Read-only rollback verification timed out');
    await vi.advanceTimersByTimeAsync(13);
    await rejected;
    reject(mismatch('Rollback row proof: action_right'));
    await vi.advanceTimersByTimeAsync(20);
    expect(verify).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
