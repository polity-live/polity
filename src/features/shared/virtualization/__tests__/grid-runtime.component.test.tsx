/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useVirtualizer: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (...args: unknown[]) => mocks.useVirtualizer(...args),
}));

import { assert, unreachable } from '../grid-runtime/asserts.js';
import { pagingReducer } from '../grid-runtime/paging-reducer.js';
import { useRows } from '../grid-runtime/use-rows.js';
import { useZeroGridVirtualizer } from '../grid-runtime/use-zero-grid-virtualizer.js';

const complete = { type: 'complete' };
const baseState = {
  estimatedTotal: 2,
  hasReachedStart: false,
  hasReachedEnd: false,
  queryAnchor: {
    listContextParams: { scope: 'all' },
    anchor: { index: 0, kind: 'forward', startRow: undefined },
  },
  pendingScrollAdjustment: 0,
  pagingPhase: 'idle',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useVirtualizer.mockReturnValue({
    scrollOffset: 0,
    scrollRect: null,
    scrollToOffset: vi.fn(),
    scrollToIndex: vi.fn(),
    getVirtualItems: vi.fn(() => []),
  });
  mocks.useQuery.mockImplementation((query: { kind?: string } | null) => {
    if (!query) return [undefined, complete];
    if (query.kind === 'single') return [{ id: 'anchor' }, complete];
    if (query.kind === 'backward') return [[{ id: 'before-2' }, { id: 'before-1' }], complete];
    return [[{ id: 'after-1' }, { id: 'after-2' }, { id: 'lookahead' }], complete];
  });
});

describe('vendored grid runtime contracts', () => {
  it('settles multi-column paging while scrolling down and back across query boundaries', () => {
    const documents = Array.from({ length: 60 }, (_, id) => ({ id: String(id) }));
    const pageCache = new Map<string, typeof documents>();
    let queryReads = 0;
    mocks.useQuery.mockImplementation(query => {
      if (++queryReads > 150) throw new Error('Paging did not settle after scrolling');
      if (!query) return [undefined, complete];
      const key = JSON.stringify(query);
      if (!pageCache.has(key)) {
        const start = query.start ? Number(query.start.id) : -1;
        pageCache.set(
          key,
          query.dir === 'backward'
            ? documents.slice(0, start).reverse().slice(0, query.limit)
            : documents.slice(start + 1, start + 1 + query.limit)
        );
      }
      return [pageCache.get(key), complete];
    });
    const items = (first: number) =>
      Array.from({ length: 21 }, (_, offset) => ({ index: first + offset }));
    let visibleItems = items(3);
    const virtualizer = {
      scrollOffset: 376,
      scrollRect: { width: 1200, height: 634 },
      scrollToOffset: vi.fn(),
      scrollToIndex: vi.fn(),
      getVirtualItems: () => visibleItems,
    };
    mocks.useVirtualizer.mockReturnValue(virtualizer);
    const options = {
      listContextParams: { scope: 'all' },
      estimateSize: () => 376,
      getScrollElement: () => null,
      getPageQuery: (query: unknown) => ({ query }),
      getSingleQuery: () => ({ query: null }),
      toStartRow: (row: { id: string }) => row,
      getRowKey: (row: { id: string }) => row.id,
      minPageSize: 18,
      maxPageSize: 48,
      lanes: 3,
      overscan: 2,
    };
    const { result, rerender, unmount } = renderHook(
      () =>
        useZeroGridVirtualizer(options) as {
          rowAt: (index: number) => { id: string } | undefined;
        }
    );
    const expectVisibleRows = () => {
      for (const { index } of visibleItems)
        expect(result.current.rowAt(index)).toEqual(documents[index]);
      expect(queryReads).toBeLessThan(150);
      queryReads = 0;
    };
    expectVisibleRows();

    visibleItems = items(24);
    virtualizer.scrollOffset = 8 * 376;
    rerender();
    expectVisibleRows();

    visibleItems = items(3);
    virtualizer.scrollOffset = 376;
    rerender();
    expectVisibleRows();
    unmount();
  });

  it('enforces assertions and unreachable branches with deterministic messages', () => {
    expect(() => assert(true)).not.toThrow();
    expect(() => assert(false)).toThrow('Assertion failed');
    expect(() => assert(false, 'custom')).toThrow('custom');
    expect(() => assert(false, (() => 'lazy') as unknown as string)).toThrow('lazy');
    expect(() => unreachable()).toThrow('Unreachable');
  });

  it('applies every paging state transition and preserves unknown actions', () => {
    expect(pagingReducer(baseState, { type: 'UPDATE_ESTIMATED_TOTAL', newTotal: 1 })).toBe(
      baseState
    );
    expect(
      pagingReducer(baseState, { type: 'UPDATE_ESTIMATED_TOTAL', newTotal: 5 }).estimatedTotal
    ).toBe(5);
    expect(pagingReducer(baseState, { type: 'REACHED_START' }).hasReachedStart).toBe(true);
    expect(pagingReducer(baseState, { type: 'REACHED_END' }).hasReachedEnd).toBe(true);
    expect(
      pagingReducer(baseState, { type: 'UPDATE_ANCHOR', anchor: { index: 3 } }).queryAnchor.anchor
    ).toEqual({ index: 3 });
    expect(
      pagingReducer(baseState, {
        type: 'SHIFT_ANCHOR_DOWN',
        newAnchor: { index: 4 },
        offset: 2,
      })
    ).toMatchObject({ pendingScrollAdjustment: 2, pagingPhase: 'adjusting' });
    expect(pagingReducer(baseState, { type: 'RESET_TO_TOP', offset: -3 })).toMatchObject({
      pendingScrollAdjustment: -3,
      pagingPhase: 'adjusting',
      queryAnchor: { anchor: { index: 0, kind: 'forward', startRow: undefined } },
    });
    expect(
      pagingReducer({ ...baseState, pendingScrollAdjustment: 3 }, { type: 'SCROLL_ADJUSTED' })
    ).toMatchObject({ estimatedTotal: 5, pendingScrollAdjustment: 0, pagingPhase: 'skipping' });
    expect(pagingReducer(baseState, { type: 'PAGING_COMPLETE' }).pagingPhase).toBe('idle');
    expect(
      pagingReducer(baseState, {
        type: 'RESET_STATE',
        estimatedTotal: 8,
        hasReachedStart: true,
        hasReachedEnd: true,
        listContextParams: { scope: 'mine' },
        anchor: { index: 2, kind: 'backward' },
      })
    ).toMatchObject({
      estimatedTotal: 8,
      hasReachedStart: true,
      hasReachedEnd: true,
      pagingPhase: 'skipping',
    });
    expect(pagingReducer(baseState, { type: 'UNKNOWN' })).toBe(baseState);
  });

  it('windows forward rows and hides the look-ahead row', () => {
    const { result } = renderHook(() =>
      useRows({
        pageSize: 2,
        anchor: { index: 4, kind: 'forward', startRow: { id: 'start' } },
        settled: true,
        getPageQuery: ({ dir }: { dir: string }) => ({ query: { kind: dir } }),
        getSingleQuery: () => ({ query: { kind: 'single' } }),
        toStartRow: (row: { id: string }) => row,
      })
    );

    expect(result.current.rowsLength).toBe(2);
    expect(result.current.rowAt(4)).toEqual({ id: 'after-1' });
    expect(result.current.rowAt(5)).toEqual({ id: 'after-2' });
    expect(result.current.rowAt(6)).toBeUndefined();
    expect(result.current).toMatchObject({ atStart: false, atEnd: false, firstRowIndex: 4 });
  });

  it('combines permalink rows around the selected anchor', () => {
    const { result } = renderHook(() =>
      useRows({
        pageSize: 4,
        anchor: { id: 'anchor', index: 5, kind: 'permalink' },
        settled: true,
        getPageQuery: ({ dir }: { dir: string }) => ({ query: { kind: dir } }),
        getSingleQuery: () => ({ query: { kind: 'single' } }),
        toStartRow: (row: { id: string }) => row,
      })
    );

    expect(result.current.rowAt(5)).toEqual({ id: 'anchor' });
    expect(result.current.rowAt(4)).toEqual({ id: 'before-2' });
    expect(result.current.rowAt(6)).toEqual({ id: 'after-1' });
    expect(result.current.rowAt(8)).toBeUndefined();
    expect(result.current.rowAt(1)).toBeUndefined();
    expect(result.current).toMatchObject({
      complete: true,
      rowsLength: 4,
      firstRowIndex: 3,
      permalinkNotFound: false,
    });
  });

  it('handles missing and loading permalink rows without issuing page queries', () => {
    mocks.useQuery.mockReturnValue([undefined, complete]);
    const missing = renderHook(() =>
      useRows({
        pageSize: 4,
        anchor: { id: 'missing', index: 5, kind: 'permalink' },
        settled: false,
        getPageQuery: vi.fn(() => ({ query: { kind: 'forward' } })),
        getSingleQuery: () => ({ query: { kind: 'single' } }),
        toStartRow: (row: { id: string }) => row,
      })
    );
    expect(missing.result.current).toMatchObject({
      rowsLength: 0,
      complete: true,
      rowsEmpty: true,
      atStart: true,
      atEnd: true,
      firstRowIndex: 5,
      permalinkNotFound: true,
    });
    expect(missing.result.current.rowAt(5)).toBeUndefined();
    expect(missing.result.current.rowAt(6)).toBeUndefined();
    expect(missing.result.current.rowAt(4)).toBeUndefined();
    missing.unmount();

    mocks.useQuery.mockReturnValue([undefined, { type: 'loading' }]);
    const loading = renderHook(() =>
      useRows({
        pageSize: 4,
        anchor: { id: 'loading', index: 2, kind: 'permalink' },
        settled: false,
        getPageQuery: vi.fn(() => ({ query: {} })),
        getSingleQuery: () => ({ query: {} }),
        toStartRow: (row: { id: string }) => row,
      })
    );
    expect(loading.result.current).toMatchObject({
      complete: false,
      rowsEmpty: true,
      atStart: false,
      atEnd: false,
      firstRowIndex: 2,
      permalinkNotFound: false,
    });
  });

  it('supports a permalink row that cannot produce a page start', () => {
    mocks.useQuery.mockImplementation((query: { kind?: string } | null) =>
      query?.kind === 'single' ? [{ id: 'anchor' }, complete] : [undefined, complete]
    );
    const { result } = renderHook(() =>
      useRows({
        pageSize: 4,
        anchor: { id: 'anchor', index: 3, kind: 'permalink' },
        settled: true,
        getPageQuery: vi.fn(() => ({ query: {} })),
        getSingleQuery: () => ({ query: { kind: 'single' } }),
        toStartRow: () => null,
      })
    );
    expect(result.current).toMatchObject({ rowsLength: 1, complete: true, rowsEmpty: true });
  });

  it('windows backward and short forward pages across every row bound', () => {
    mocks.useQuery.mockImplementation((query: { kind?: string } | null) =>
      query
        ? [[{ id: 'one' }, { id: 'two' }, { id: 'lookahead' }], complete]
        : [undefined, complete]
    );
    const backward = renderHook(() =>
      useRows({
        pageSize: 2,
        anchor: { index: 5, kind: 'backward', startRow: { id: 'start' } },
        settled: true,
        getPageQuery: ({ dir }: { dir: string }) => ({ query: { kind: dir } }),
        getSingleQuery: () => ({ query: {} }),
        toStartRow: (row: { id: string }) => row,
      })
    );
    expect(backward.result.current.rowAt(4)).toEqual({ id: 'one' });
    expect(backward.result.current.rowAt(3)).toEqual({ id: 'two' });
    expect(backward.result.current.rowAt(2)).toBeUndefined();
    expect(backward.result.current.rowAt(5)).toBeUndefined();
    expect(backward.result.current).toMatchObject({ atStart: false, firstRowIndex: 3 });
    backward.unmount();

    mocks.useQuery.mockImplementation((query: unknown) =>
      query ? [[{ id: 'one' }], complete] : [undefined, complete]
    );
    const forward = renderHook(() =>
      useRows({
        pageSize: 2,
        anchor: { index: 0, kind: 'forward', startRow: { id: 'start' } },
        settled: true,
        getPageQuery: () => ({ query: {} }),
        getSingleQuery: () => ({ query: {} }),
        toStartRow: (row: { id: string }) => row,
      })
    );
    expect(forward.result.current).toMatchObject({ atStart: true, atEnd: true, rowsLength: 1 });
  });

  it('guards an unknown anchor direction through the unreachable row accessor', () => {
    const { result } = renderHook(() =>
      useRows({
        pageSize: 2,
        anchor: { index: 1, kind: 'unknown', startRow: { id: 'start' } } as any,
        settled: true,
        getPageQuery: () => ({ query: { kind: 'unknown' } }),
        getSingleQuery: () => ({ query: {} }),
        toStartRow: (row: { id: string }) => row,
      })
    );
    expect(() => result.current.rowAt(1)).toThrow('Unreachable');
  });

  it('connects query windowing, virtualizer options, and settle state', () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    const listContextParams = { scope: 'all' };
    const { result } = renderHook(() =>
      useZeroGridVirtualizer({
        estimateSize: () => 20,
        getScrollElement: () => null,
        listContextParams,
        getPageQuery: ({ dir }: { dir: string }) => ({ query: { kind: dir } }),
        getSingleQuery: () => ({ query: { kind: 'single' } }),
        toStartRow: (row: { id: string }) => row,
        getRowKey: (row: { id: string }) => row.id,
        settleTime: 10,
        onSettled,
      })
    );

    expect(result.current).toMatchObject({
      complete: true,
      rowsEmpty: false,
      permalinkNotFound: false,
      settled: false,
    });
    expect(mocks.useVirtualizer).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3, horizontal: false, overscan: 5 })
    );
    act(() => vi.advanceTimersByTime(10));
    expect((result.current as { settled: boolean }).settled).toBe(true);
    expect(onSettled).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
