/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInfiniteTimeline } from '../useInfiniteTimeline';

const observerState = vi.hoisted(() => ({
  callback: null as IntersectionObserverCallback | null,
  disconnect: vi.fn(),
  observe: vi.fn(),
  options: null as IntersectionObserverInit | null,
}));

beforeEach(() => {
  observerState.callback = null;
  observerState.disconnect.mockClear();
  observerState.observe.mockClear();
  observerState.options = null;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observerState.callback = callback;
        observerState.options = options ?? null;
      }
      observe = observerState.observe;
      disconnect = observerState.disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [];
    }
  );
});

describe('useInfiniteTimeline', () => {
  it('auto-loads an empty feed and appends subsequent cursor pages once', async () => {
    let resolveFirst!: (value: any) => void;
    const fetchMore = vi
      .fn()
      .mockImplementationOnce(() => new Promise(resolve => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ items: [2], nextCursor: null, hasMore: false });
    const { result } = renderHook(() =>
      useInfiniteTimeline<number>({ fetchMore, autoLoad: false, pageSize: 1 })
    );

    await waitFor(() => expect(fetchMore).toHaveBeenCalledWith(null, 1));
    expect(result.current.isLoading).toBe(true);
    act(() => void result.current.loadMore());
    expect(fetchMore).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFirst({ items: [1], nextCursor: 'next', hasMore: true });
      await Promise.resolve();
    });
    expect(result.current).toMatchObject({ items: [1], page: 2, totalLoaded: 1, hasMore: true });

    await act(async () => result.current.loadMore());
    expect(fetchMore).toHaveBeenLastCalledWith('next', 1);
    expect(result.current).toMatchObject({ items: [1, 2], page: 3, hasMore: false });
    await act(async () => result.current.loadMore());
    expect(fetchMore).toHaveBeenCalledTimes(2);
  });

  it('shows the incremental loading state for a non-empty feed', async () => {
    let resolvePage!: (value: any) => void;
    const fetchMore = vi.fn(
      (_cursor: string | null, _pageSize: number) =>
        new Promise<{ items: string[]; nextCursor: string | null; hasMore: boolean }>(
          resolve => (resolvePage = resolve)
        )
    );
    const { result } = renderHook(() =>
      useInfiniteTimeline({ initialItems: ['initial'], fetchMore, autoLoad: false })
    );
    act(() => void result.current.loadMore());
    expect(result.current.isLoadingMore).toBe(true);
    await act(async () => {
      resolvePage({ items: ['next'], nextCursor: null, hasMore: false });
      await Promise.resolve();
    });
    expect(result.current.isLoadingMore).toBe(false);
  });

  it.each([
    [new Error('load failed'), 'load failed'],
    ['bad load', 'Failed to load more items'],
  ])('normalizes load errors from %p', async (failure, message) => {
    const fetchMore = vi.fn().mockRejectedValue(failure);
    const { result } = renderHook(() =>
      useInfiniteTimeline({ initialItems: [1], fetchMore, autoLoad: false })
    );
    await act(async () => result.current.loadMore());
    expect(result.current.error?.message).toBe(message);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('refreshes from the first page and resets all pagination state', async () => {
    const fetchMore = vi
      .fn()
      .mockResolvedValueOnce({ items: [2], nextCursor: 'page-2', hasMore: true })
      .mockResolvedValueOnce({ items: [9], nextCursor: null, hasMore: false });
    const { result } = renderHook(() =>
      useInfiniteTimeline({ initialItems: [1], fetchMore, autoLoad: false })
    );
    await act(async () => result.current.loadMore());
    await act(async () => result.current.refresh());
    expect(fetchMore).toHaveBeenLastCalledWith(null, 20);
    expect(result.current).toMatchObject({
      items: [9],
      page: 1,
      hasMore: false,
      error: null,
      isLoading: false,
    });
  });

  it.each([
    [new Error('refresh failed'), 'refresh failed'],
    [42, 'Failed to refresh items'],
  ])('normalizes refresh errors from %p', async (failure, message) => {
    const fetchMore = vi.fn().mockRejectedValue(failure);
    const { result } = renderHook(() =>
      useInfiniteTimeline({ initialItems: [1], fetchMore, autoLoad: false })
    );
    await act(async () => result.current.refresh());
    expect(result.current.error?.message).toBe(message);
    expect(result.current.isLoading).toBe(false);
  });

  it('observes a sentinel, ignores non-intersections, loads intersections, and disconnects', async () => {
    const fetchMore = vi.fn().mockResolvedValue({ items: [2], nextCursor: null, hasMore: false });
    const hook = renderHook(
      ({ autoLoad, threshold }) =>
        useInfiniteTimeline({ initialItems: [1], fetchMore, autoLoad, threshold }),
      { initialProps: { autoLoad: false, threshold: 250 } }
    );
    expect(observerState.callback).toBeNull();
    (hook.result.current.sentinelRef as any).current = document.createElement('div');
    hook.rerender({ autoLoad: true, threshold: 250 });
    expect(observerState.observe).toHaveBeenCalledOnce();
    expect(observerState.options).toMatchObject({ root: null, rootMargin: '250px', threshold: 0 });

    act(() => observerState.callback?.([{ isIntersecting: false } as any], {} as any));
    expect(fetchMore).not.toHaveBeenCalled();
    await act(async () => {
      observerState.callback?.([{ isIntersecting: true } as any], {} as any);
      await Promise.resolve();
    });
    expect(fetchMore).toHaveBeenCalledOnce();
    hook.unmount();
    expect(observerState.disconnect).toHaveBeenCalledTimes(2);
  });
});
