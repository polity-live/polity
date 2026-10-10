import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForRollback, watchMutationSnapshot } from '../mutation-snapshot';

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
    map.set('m/writer/1', { error: 'app', message: 'private fixture content' });
    await vi.advanceTimersByTimeAsync(5);
    expect(await watcher.promise).toEqual({ mutationID: 1, at: expect.any(Number) });
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
