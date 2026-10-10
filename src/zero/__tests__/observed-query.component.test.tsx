// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
const query = vi.hoisted(() => vi.fn());
vi.mock('@rocicorp/zero/react', () => ({ useQuery: query }));

afterEach(() => {
  vi.unstubAllGlobals();
  query.mockReset();
});
describe('Optional application query observation', () => {
  it('keeps activation identities unique when another bundled observer instance starts', async () => {
    const sink = vi.fn();
    vi.stubGlobal('__zeroPerformanceView', sink);
    query.mockReturnValue([[], { type: 'complete' }]);
    const request = { query: { queryName: 'groups.byId' }, args: { id: 'visible' } } as any;
    vi.resetModules();
    const first = await import('../observed-query');
    const firstHook = renderHook(() => first.useQuery(request));
    const firstID = sink.mock.lastCall?.[0].activationID;
    firstHook.unmount();
    vi.resetModules();
    const second = await import('../observed-query');
    const secondHook = renderHook(() => second.useQuery(request));
    const secondID = sink.mock.lastCall?.[0].activationID;
    expect(firstID).toMatch(/^view:[0-9a-f-]{36}$/);
    expect(secondID).toMatch(/^view:[0-9a-f-]{36}$/);
    expect(secondID).not.toBe(firstID);
    secondHook.unmount();
  });
  it('forwards the public hook arguments and reports real partial/complete results without changing them', async () => {
    const sink = vi.fn();
    vi.stubGlobal('__zeroPerformanceView', sink);
    vi.resetModules();
    const { useQuery } = await import('../observed-query');
    const request = { query: { queryName: 'groups.byId' }, args: { id: 'visible' } } as any;
    const partial = [undefined, { type: 'unknown' }] as const;
    const complete = [{ id: 'visible', name: 'Private data' }, { type: 'complete' }] as const;
    query.mockReturnValue(partial);
    const hook = renderHook(() => useQuery(request, { ttl: '10m' }));
    expect(hook.result.current).toBe(partial);
    expect(query).toHaveBeenLastCalledWith(request, { ttl: '10m' });
    expect(sink).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'groups.byId', type: 'unknown', ids: [] })
    );
    query.mockReturnValue(complete);
    hook.rerender();
    expect(hook.result.current).toBe(complete);
    expect(sink).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: { id: 'visible' }, type: 'complete', ids: ['visible'] })
    );
    expect(sink.mock.lastCall?.[0]).not.toHaveProperty('data');
    const event = sink.mock.lastCall?.[0];
    expect(event.activationID).toBe(sink.mock.calls[0][0].activationID);
    expect(event.at).toBeGreaterThanOrEqual(event.activatedAt);
    hook.unmount();
    expect(sink.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ activationID: event.activationID, phase: 'release' })
    );
  });
  it('exports the unchanged public hook when no benchmark sink was installed at startup', async () => {
    vi.resetModules();
    const { useQuery } = await import('../observed-query');
    expect(useQuery).toBe(query);
    query.mockReturnValue([undefined, { type: 'unknown' }]);
    const hook = renderHook(() => useQuery(undefined));
    const lateSink = vi.fn();
    vi.stubGlobal('__zeroPerformanceView', lateSink);
    hook.rerender();
    expect(lateSink).not.toHaveBeenCalled();
    hook.unmount();
  });
  it('preserves disabled queries and reports virtualizer readiness separately from paint', async () => {
    const view = vi.fn();
    const ready = vi.fn();
    vi.stubGlobal('__zeroPerformanceView', view);
    vi.stubGlobal('__zeroPerformanceReady', ready);
    vi.resetModules();
    const { useQuery, observeRouteReadiness } = await import('../observed-query');
    query.mockReturnValue([undefined, { type: 'unknown' }]);
    renderHook(() => useQuery(undefined));
    expect(query).toHaveBeenCalledWith(undefined);
    expect(view).not.toHaveBeenCalled();
    observeRouteReadiness('search.searchDocumentPage', false);
    observeRouteReadiness('search.searchDocumentPage', true);
    expect(ready.mock.calls.map(call => call.slice(0, 2))).toEqual([
      ['search.searchDocumentPage', false],
      ['search.searchDocumentPage', true],
    ]);
  });
});
