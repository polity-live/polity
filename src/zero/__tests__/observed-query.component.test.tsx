// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
const query = vi.hoisted(() => vi.fn());
vi.mock('@rocicorp/zero/react', () => ({ useQuery: query }));

afterEach(() => {
  vi.unstubAllGlobals();
  query.mockReset();
  vi.useRealTimers();
});
describe('Optional application query observation', () => {
  it('uses the real public SDK to share overlapping consumers and rematerialize after release or retry', async () => {
    const { useQuery, ZeroProvider } =
      await vi.importActual<typeof import('@rocicorp/zero/react')>('@rocicorp/zero/react');
    const { queries } = await import('../queries');
    vi.useFakeTimers();
    const listeners: ((data: unknown[], type: string, error?: unknown) => void)[] = [];
    const destroy = vi.fn();
    const zero = {
      clientID: crypto.randomUUID(),
      context: { userID: 'owner' },
      materialize: vi.fn(() => ({
        addListener: (listener: (data: unknown[], type: string, error?: unknown) => void) => {
          listeners.push(listener);
          listener([], 'complete');
          return vi.fn();
        },
        destroy,
        updateTTL: vi.fn(),
      })),
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ZeroProvider, { zero: zero as any, children });
    const request = () => queries.rbac.viewerGuestAccesses({});
    const first = renderHook(() => useQuery(request()), { wrapper });
    const second = renderHook(() => useQuery(request()), { wrapper });
    expect(zero.materialize).toHaveBeenCalledTimes(1);
    expect(first.result.current[1].type).toBe('complete');
    expect(second.result.current[0]).toBe(first.result.current[0]);
    second.unmount();
    act(() => vi.advanceTimersByTime(11));
    expect(destroy).not.toHaveBeenCalled();
    act(() => listeners[0]([], 'error', { error: 'app', message: 'retry needed' }));
    act(() => {
      const status = first.result.current[1];
      if (status.type !== 'error') throw new Error('Expected public error result');
      status.retry();
    });
    expect(zero.materialize).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
    first.unmount();
    act(() => vi.advanceTimersByTime(11));
    expect(destroy).toHaveBeenCalledTimes(2);
    const remount = renderHook(() => useQuery(request()), { wrapper });
    expect(zero.materialize).toHaveBeenCalledTimes(3);
    remount.unmount();
    act(() => vi.advanceTimersByTime(11));
  });
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
