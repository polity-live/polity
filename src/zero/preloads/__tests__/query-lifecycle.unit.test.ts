import { afterEach, describe, expect, it, vi } from 'vitest';
import { retainZeroPreloadHandle } from '../preload-registry';
import type { PreloadLifecycleEvent } from '../query-lifecycle';
import { observePreload } from '../query-lifecycle';
afterEach(() => vi.unstubAllGlobals());
describe('Preload lifecycle observation', () => {
  it('reports missing client identity as an empty string', () => {
    const sink = vi.fn();
    vi.stubGlobal('__zeroPerformancePreload', sink);
    observePreload(undefined, 'query', 'preload-start', 'none', 'activation');
    expect(sink).toHaveBeenCalledExactlyOnceWith({
      activationID: 'activation',
      clientID: '',
      key: 'query',
      phase: 'preload-start',
      at: expect.any(Number),
      ttl: 'none',
    });
  });
  it('observes completion and delayed release for abandoned in-flight work without inventing materialization', async () => {
    const events: PreloadLifecycleEvent[] = [];
    vi.stubGlobal('__zeroPerformancePreload', (event: PreloadLifecycleEvent) => events.push(event));
    let complete!: () => void;
    const cleanup = vi.fn();
    const zero = {
      clientID: 'isolated-client',
      preload: () => ({
        cleanup,
        complete: new Promise<void>(resolve => {
          complete = resolve;
        }),
      }),
    };
    const handle = retainZeroPreloadHandle(zero, {
      key: 'queries.groups.byId:{"id":"group"}',
      query: {},
      ttl: '10m',
    });
    handle.release();
    expect(events.map(event => event.phase)).toEqual(['preload-start']);
    complete();
    await handle.complete;
    expect(events.map(event => event.phase)).toEqual([
      'preload-start',
      'preload-complete',
      'preload-release',
    ]);
    expect(
      events.every(
        event =>
          event.clientID === zero.clientID && Number.isFinite(event.at) && event.ttl === '10m'
      )
    ).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
