import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRELOAD_CACHE_TTL_MS, PreloadCoordinator, type PreloadTask } from '../preload-coordinator';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function preloadTask(key: string): PreloadTask {
  return {
    key,
    entries: [{ key: `query:${key}`, query: { key } }],
    route: { href: `/${key}` },
  };
}

function fakeZero() {
  const pending = new Map<string, ReturnType<typeof deferred>>();
  const cleanups = new Map<string, ReturnType<typeof vi.fn>>();
  const preload = vi.fn((query: unknown) => {
    const key = (query as { key: string }).key;
    const completion = deferred();
    const cleanup = vi.fn();
    pending.set(key, completion);
    cleanups.set(key, cleanup);
    return { cleanup, complete: completion.promise };
  });
  return { cleanups, pending, preload, zero: { preload } };
}

async function flush() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe('PreloadCoordinator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits for the foreground task and an idle turn before starting one background task', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setIdleTasks('primary', [preloadTask('second'), preloadTask('third')], 3);
    coordinator.activate(preloadTask('first'));

    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload).toHaveBeenCalledTimes(1);

    fake.pending.get('first')?.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(249);
    expect(fake.preload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.preload).toHaveBeenCalledTimes(2);
    expect(fake.preload.mock.calls[1]?.[0]).toEqual({ key: 'second' });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fake.preload).toHaveBeenCalledTimes(2);
    coordinator.dispose();
  });

  it('cancels a background preload synchronously when another route becomes foreground', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setIdleTasks('entity', [preloadTask('background')], 2);
    await vi.advanceTimersByTimeAsync(250);

    coordinator.activate(preloadTask('foreground'));

    expect(fake.cleanups.get('background')).toHaveBeenCalledTimes(1);
    expect(fake.preload.mock.calls.at(-1)?.[0]).toEqual({ key: 'foreground' });
    coordinator.dispose();
  });

  it('lets a settled hover intent preempt lower-priority idle work', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setIdleTasks('primary', [preloadTask('idle')], 3);
    await vi.advanceTimersByTimeAsync(250);

    coordinator.scheduleIntent(preloadTask('intent'));
    await vi.advanceTimersByTimeAsync(50);

    expect(fake.cleanups.get('idle')).toHaveBeenCalledTimes(1);
    expect(fake.preload.mock.calls.at(-1)?.[0]).toEqual({ key: 'intent' });
    coordinator.dispose();
  });

  it('promotes the matching background task without starting the same query again', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    const target = preloadTask('target');
    coordinator.setIdleTasks('entity', [target], 2);
    await vi.advanceTimersByTimeAsync(250);

    coordinator.activate(target);
    expect(fake.preload).toHaveBeenCalledTimes(1);
    expect(fake.cleanups.get('target')).not.toHaveBeenCalled();

    fake.pending.get('target')?.resolve();
    await flush();
    expect(fake.cleanups.get('target')).toHaveBeenCalledTimes(1);
    expect(coordinator.getState('target')).toBe('ready');
    coordinator.dispose();
  });

  it('reuses ready data for ten minutes and becomes preloadable after expiry', async () => {
    let now = 1_000;
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn(), () => now);
    const target = preloadTask('cached');

    coordinator.activate(target);
    fake.pending.get('cached')?.resolve();
    await flush();
    coordinator.deactivate(target.key);
    coordinator.activate(target);
    expect(fake.preload).toHaveBeenCalledTimes(1);

    now += PRELOAD_CACHE_TTL_MS + 1;
    coordinator.deactivate(target.key);
    coordinator.activate(target);
    expect(fake.preload).toHaveBeenCalledTimes(2);
    coordinator.dispose();
  });

  it('runs dependent entries only after the base phase completes', async () => {
    const fake = fakeZero();
    const resolveAfterComplete = vi.fn(async () => [
      { key: 'query:dependent', query: { key: 'dependent' } },
    ]);
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.activate({ ...preloadTask('base'), resolveAfterComplete });

    expect(resolveAfterComplete).not.toHaveBeenCalled();
    fake.pending.get('base')?.resolve();
    await flush();
    expect(resolveAfterComplete).toHaveBeenCalledTimes(1);
    expect(fake.preload.mock.calls.at(-1)?.[0]).toEqual({ key: 'dependent' });
    coordinator.dispose();
  });

  it('does not start idle work while the router is pending', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setRouterIdle(false);
    coordinator.setIdleTasks('primary', [preloadTask('later')], 3);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fake.preload).not.toHaveBeenCalled();

    coordinator.setRouterIdle(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });

  it('skips entity tasks that are not present in the authorized navigation', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setVisibleRoutes(['/allowed']);
    coordinator.setIdleTasks('entity', [preloadTask('hidden'), preloadTask('allowed')], 2, true);

    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload).toHaveBeenCalledTimes(1);
    expect(fake.preload.mock.calls[0]?.[0]).toEqual({ key: 'allowed' });
    coordinator.dispose();
  });
});
