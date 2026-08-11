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
    vi.unstubAllGlobals();
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

  it('covers deactivate, clear-scope, empty-entry, intent timer, and state boundaries', async () => {
    const fake = fakeZero();
    const route = vi.fn();
    const coordinator = new PreloadCoordinator(fake.zero, route);
    expect(coordinator.getState('missing')).toBe('queued');
    coordinator.deactivate('missing');
    coordinator.clearIdleTasks('missing');

    coordinator.activate({ key: 'empty', entries: [], route: { href: '/empty' } });
    await flush();
    expect(coordinator.getState('empty')).toBe('ready');
    coordinator.deactivate('other');
    coordinator.deactivate('empty');

    coordinator.scheduleIntent(preloadTask('cancelled'), 50);
    coordinator.cancelIntent('cancelled');
    await vi.advanceTimersByTimeAsync(50);
    expect(fake.preload).not.toHaveBeenCalled();

    coordinator.scheduleIntent(preloadTask('immediate'), 0);
    expect(coordinator.getState('immediate')).toBe('preloading');
    coordinator.cancelIntent('unknown');
    coordinator.pauseSpeculation();
    expect(fake.cleanups.get('immediate')).toHaveBeenCalledOnce();
    coordinator.dispose();
    coordinator.activate(preloadTask('after-dispose'));
    coordinator.scheduleIntent(preloadTask('disposed-intent'), 0);
    expect(fake.preload).toHaveBeenCalledTimes(1);
  });

  it('cancels matching foreground and scoped background work', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.activate(preloadTask('foreground'));
    coordinator.deactivate('foreground');
    expect(fake.cleanups.get('foreground')).toHaveBeenCalledOnce();

    coordinator.setIdleTasks('scope', [preloadTask('scope:background')], 2);
    await vi.advanceTimersByTimeAsync(250);
    coordinator.clearIdleTasks('scope');
    expect(fake.cleanups.get('scope:background')).toHaveBeenCalledOnce();
    coordinator.dispose();
  });

  it('marks foreground failures and retries a speculative background failure once', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.activate(preloadTask('foreground-failure'));
    fake.pending.get('foreground-failure')?.reject(new Error('foreground'));
    await flush();
    expect(coordinator.getState('foreground-failure')).toBe('failed');

    coordinator.deactivate('foreground-failure');
    coordinator.setIdleTasks('retry', [preloadTask('retry:background')], 2);
    await vi.advanceTimersByTimeAsync(250);
    fake.pending.get('retry:background')?.reject(new Error('first'));
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fake.preload).toHaveBeenCalledTimes(3);
    fake.pending.get('retry:background')?.reject(new Error('second'));
    await flush();
    expect(coordinator.getState('retry:background')).toBe('failed');
    expect(warning).toHaveBeenCalled();
    coordinator.dispose();
  });

  it('does not revive cancelled dependent phases or retries after disposal', async () => {
    const fake = fakeZero();
    const dependent = deferred();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.activate({
      ...preloadTask('base-cancelled'),
      resolveAfterComplete: vi.fn(() =>
        dependent.promise.then(() => [preloadTask('late').entries[0]])
      ),
    });
    fake.pending.get('base-cancelled')?.resolve();
    await flush();
    coordinator.deactivate('base-cancelled');
    dependent.resolve();
    await flush();
    expect(fake.preload).toHaveBeenCalledTimes(1);

    coordinator.setIdleTasks('retry', [preloadTask('retry:disposed')], 2);
    await vi.advanceTimersByTimeAsync(250);
    fake.pending.get('retry:disposed')?.reject(new Error('offline'));
    await flush();
    coordinator.dispose();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fake.preload).toHaveBeenCalledTimes(2);
  });

  it('honors visibility, offline, constrained-network, and window idle callback guards', async () => {
    const fake = fakeZero();
    const requestIdleCallback = vi.fn((callback: () => void) => {
      callback();
      return 17;
    });
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('window', { requestIdleCallback, cancelIdleCallback });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: { saveData: false, effectiveType: '4g' },
    });
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setIdleTasks('idle-api', [preloadTask('window-idle')], 2);
    expect(requestIdleCallback).toHaveBeenCalled();
    expect(fake.preload).toHaveBeenCalledOnce();
    coordinator.setRouterIdle(false);
    coordinator.dispose();

    for (const navigatorValue of [
      { onLine: false },
      { onLine: true, connection: { saveData: true, effectiveType: '4g' } },
      { onLine: true, connection: { saveData: false, effectiveType: 'slow-2g' } },
      { onLine: true, connection: { saveData: false, effectiveType: '2g' } },
    ]) {
      vi.stubGlobal('navigator', navigatorValue);
      const guarded = new PreloadCoordinator(fakeZero().zero, vi.fn());
      guarded.setIdleTasks('guarded', [preloadTask('never')], 2);
      expect(requestIdleCallback).toHaveBeenCalledTimes(1);
      guarded.dispose();
    }

    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    const hidden = new PreloadCoordinator(fakeZero().zero, vi.fn());
    hidden.setIdleTasks('hidden', [preloadTask('never')], 2);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    hidden.dispose();
    vi.unstubAllGlobals();
  });

  it('normalizes visible routes and schedules priority scopes without browser globals', async () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('window', undefined);
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setVisibleRoutes(['/allowed/?tab=one#section']);
    coordinator.setIdleTasks('low', [preloadTask('low')], 3, true);
    coordinator.setIdleTasks(
      'high',
      [{ ...preloadTask('high'), route: { href: '/allowed?tab=two' } }],
      1,
      true
    );
    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload.mock.calls[0]?.[0]).toEqual({ key: 'high' });
    fake.pending.get('high')?.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(250);
    coordinator.dispose();
  });

  it('covers ready, pending, running, stale completion, and empty idle queue decisions', async () => {
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    const ready = preloadTask('ready-intent');
    coordinator.activate(ready);
    fake.pending.get('ready-intent')?.resolve();
    await flush();
    coordinator.scheduleIntent(ready, 0);
    expect(fake.preload).toHaveBeenCalledTimes(1);
    coordinator.deactivate(ready.key);

    const foreground = preloadTask('foreground-pending');
    coordinator.activate(foreground);
    coordinator.scheduleIntent(preloadTask('queued-during-foreground'), 0);
    expect(fake.preload).toHaveBeenCalledTimes(2);
    coordinator.deactivate(foreground.key);
    coordinator.cancelIntent('queued-during-foreground');

    coordinator.setIdleTasks('running', [preloadTask('running:background')], 1);
    await vi.advanceTimersByTimeAsync(250);
    coordinator.scheduleIntent(preloadTask('running:background'), 0);
    expect(coordinator.getState('running:background')).toBe('preloading');
    fake.pending.get('running:background')?.resolve();
    await flush();

    const staleResolve = preloadTask('stale-resolve');
    coordinator.activate(staleResolve);
    coordinator.deactivate(staleResolve.key);
    fake.pending.get('stale-resolve')?.resolve();
    await flush();

    const staleReject = preloadTask('stale-reject');
    coordinator.activate(staleReject);
    coordinator.deactivate(staleReject.key);
    fake.pending.get('stale-reject')?.reject(new Error('stale'));
    await flush();

    coordinator.clearIdleTasks('running');
    await vi.advanceTimersByTimeAsync(250);
    coordinator.scheduleIntent(preloadTask('dispose-timer'), 50);
    coordinator.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips ready and failed tasks while draining background queues', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    const cached = preloadTask('cached-scope');
    coordinator.activate(cached);
    fake.pending.get('cached-scope')?.resolve();
    await flush();
    coordinator.deactivate(cached.key);
    coordinator.setIdleTasks('cached', [cached, preloadTask('after-cached')], 1);
    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload.mock.calls.at(-1)?.[0]).toEqual({ key: 'after-cached' });
    coordinator.dispose();

    const failingFake = fakeZero();
    const failing = new PreloadCoordinator(failingFake.zero, vi.fn());
    const failedTask = preloadTask('failed-scope');
    failing.setIdleTasks('failed', [failedTask], 1);
    await vi.advanceTimersByTimeAsync(250);
    failingFake.pending.get('failed-scope')?.reject(new Error('first'));
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    failingFake.pending.get('failed-scope')?.reject(new Error('second'));
    await flush();
    const blocker = preloadTask('failure-blocker');
    failing.activate(blocker);
    failing.scheduleIntent(failedTask, 0);
    failing.deactivate(blocker.key);
    await vi.advanceTimersByTimeAsync(250);
    expect(failing.getState('failed-scope')).toBe('failed');
    expect(warning).toHaveBeenCalled();
    failing.dispose();
  });

  it('rechecks speculation inside an idle callback and drains a valid queued intent', async () => {
    const visibility = { visibilityState: 'visible' };
    vi.stubGlobal('document', visibility);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', undefined);
    const fake = fakeZero();
    const coordinator = new PreloadCoordinator(fake.zero, vi.fn());
    coordinator.setIdleTasks('empty', [], 1);
    visibility.visibilityState = 'hidden';
    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload).not.toHaveBeenCalled();

    visibility.visibilityState = 'visible';
    const foreground = preloadTask('queue-foreground');
    coordinator.activate(foreground);
    coordinator.scheduleIntent(preloadTask('queued-valid'), 0);
    coordinator.deactivate(foreground.key);
    await vi.advanceTimersByTimeAsync(250);
    expect(fake.preload.mock.calls.at(-1)?.[0]).toEqual({ key: 'queued-valid' });
    coordinator.dispose();
  });
});
