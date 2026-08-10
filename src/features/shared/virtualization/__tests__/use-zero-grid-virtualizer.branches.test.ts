import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scenario: {} as any,
  refIndex: 0,
  cleanups: [] as (() => void)[],
  virtualizerConfig: undefined as any,
  initialState: undefined as any,
  dispatch: vi.fn(),
  setSettled: vi.fn(),
  setPageSize: vi.fn(),
}));

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) =>
    initial === false
      ? [mocks.scenario.settled ?? false, mocks.setSettled]
      : [mocks.scenario.pageSize ?? initial, mocks.setPageSize],
  useRef: (initial: unknown) => {
    const index = mocks.refIndex++;
    if (index === 0) return { current: mocks.scenario.awaitingInitial ?? initial };
    if (index === 1) return { current: mocks.scenario.previousOffset };
    if (index === 3 && mocks.scenario.hasAppliedScrollOverride) {
      return { current: mocks.scenario.appliedScrollInitial };
    }
    return { current: initial };
  },
  useReducer: (_reducer: unknown, argument: unknown, initializer: (value: unknown) => unknown) => {
    mocks.initialState = initializer(argument);
    return [mocks.scenario.paging ?? mocks.initialState, mocks.dispatch];
  },
  useEffect: (effect: () => undefined | (() => void)) => {
    const cleanup = effect();
    if (cleanup) mocks.cleanups.push(cleanup);
  },
  useLayoutEffect: (effect: () => undefined | (() => void)) => {
    const cleanup = effect();
    if (cleanup) mocks.cleanups.push(cleanup);
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (config: unknown) => {
    mocks.virtualizerConfig = config;
    return mocks.scenario.virtualizer;
  },
}));

vi.mock('@tanstack/virtual-core', () => ({
  defaultKeyExtractor: (index: number) => `default-${index}`,
}));

vi.mock('../grid-runtime/use-rows', () => ({
  useRows: () => mocks.scenario.rows,
}));

import { useZeroGridVirtualizer } from '../grid-runtime/use-zero-grid-virtualizer.js';

const context = { scope: 'all' };

function basePaging(listContextParams = context) {
  return {
    estimatedTotal: 10,
    hasReachedStart: false,
    hasReachedEnd: false,
    queryAnchor: {
      anchor: { index: 0, kind: 'forward', startRow: undefined },
      listContextParams,
    },
    pagingPhase: 'idle',
    pendingScrollAdjustment: 0,
  };
}

function baseRows() {
  return {
    rowAt: (index: number) => (mocks.scenario.rowMissing ? undefined : { id: `row-${index}` }),
    rowsLength: 4,
    complete: true,
    rowsEmpty: false,
    atStart: false,
    atEnd: false,
    firstRowIndex: 0,
    permalinkNotFound: false,
  };
}

function baseVirtualizer() {
  return {
    scrollOffset: 0,
    scrollRect: null,
    scrollToOffset: vi.fn(),
    scrollToIndex: vi.fn(),
    getVirtualItems: vi.fn(() => []),
  };
}

function run(scenario: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  mocks.scenario = {
    paging: basePaging(),
    rows: baseRows(),
    virtualizer: baseVirtualizer(),
    ...scenario,
  };
  mocks.refIndex = 0;
  mocks.cleanups = [];
  mocks.virtualizerConfig = undefined;
  mocks.dispatch.mockClear();
  mocks.setSettled.mockClear();
  mocks.setPageSize.mockClear();

  const result = useZeroGridVirtualizer({
    estimateSize: () => 20,
    getScrollElement: () => null,
    listContextParams: context,
    getPageQuery: () => ({ query: {} }),
    getSingleQuery: () => ({ query: {} }),
    toStartRow: (row: unknown) => row,
    ...options,
  }) as { estimatedTotal?: number; rowsEmpty: boolean; total?: number };
  return { result, scenario: mocks.scenario as any, config: mocks.virtualizerConfig };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  for (const cleanup of mocks.cleanups) cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useZeroGridVirtualizer branch contracts', () => {
  it('initializes top, permalink, and matching persisted anchors', () => {
    let call = run();
    expect(mocks.initialState.queryAnchor.anchor).toMatchObject({ kind: 'forward', index: 0 });
    expect(call.result.total).toBeUndefined();

    run({}, { permalinkID: 'permalink' });
    expect(mocks.initialState.queryAnchor.anchor).toMatchObject({
      kind: 'permalink',
      id: 'permalink',
    });

    const scrollState = {
      anchor: { index: 3, kind: 'backward' },
      scrollTop: 42,
      estimatedTotal: 30,
      hasReachedStart: true,
      hasReachedEnd: true,
      listContextParams: context,
    };
    call = run({}, { scrollState });
    expect(mocks.initialState).toMatchObject({
      estimatedTotal: 30,
      hasReachedStart: true,
      hasReachedEnd: true,
      queryAnchor: { anchor: scrollState.anchor },
    });
    expect(call.config.initialOffset()).toBe(42);

    const stale = { ...scrollState, listContextParams: { scope: 'other' } };
    run({}, { scrollState: stale, permalinkID: 'fresh' });
    expect(mocks.initialState.queryAnchor.anchor).toMatchObject({ id: 'fresh' });
  });

  it('normalizes sizing, internal counts, explicit counts, and item keys', () => {
    let call = run(
      {
        rows: { ...baseRows(), atStart: true, atEnd: true, rowsLength: 2 },
        virtualizer: { ...baseVirtualizer(), scrollRect: { height: 2000 } },
        pageSize: 2,
      },
      { minPageSize: 3, maxPageSize: 999, getRowKey: (row: any) => row.id }
    );
    expect(call.config.count).toBe(2);
    expect(call.config.getItemKey(1)).toBe('row-1');
    call.scenario.rowMissing = true;
    expect(call.config.getItemKey(1)).toBe('default-1');
    expect(mocks.setPageSize).toHaveBeenCalledWith(198);

    call = run(
      { rows: { ...baseRows(), rowsLength: 0, atEnd: false } },
      { count: 0, getItemKey: (index: number) => `custom-${index}` }
    );
    expect(call.config.count).toBe(0);
    expect(call.config.getItemKey(2)).toBe('custom-2');
    expect(call.result.rowsEmpty).toBe(true);
    expect(call.result.estimatedTotal).toBe(0);

    call = run({ rows: { ...baseRows(), atEnd: false, rowsLength: 4 } }, { count: 7 });
    expect(call.config.count).toBe(7);
    expect(call.result.rowsEmpty).toBe(false);
  });

  it('uses every initial offset and page-size fallback', () => {
    let call = run(
      {
        paging: {
          ...basePaging(),
          queryAnchor: {
            anchor: { id: 'p', index: 2, kind: 'permalink' },
            listContextParams: context,
          },
        },
        pageSize: 200,
      },
      { minPageSize: 2, maxPageSize: 4 }
    );
    expect(call.config.initialOffset()).toBe(40);
    expect(mocks.setPageSize).not.toHaveBeenCalled();

    call = run({ pageSize: 2 }, { minPageSize: 2, maxPageSize: 4 });
    expect(call.config.initialOffset()).toBe(0);
    expect(mocks.setPageSize).toHaveBeenCalledWith(4);
  });

  it('resets settle timers, invokes callbacks, and persists scroll state', () => {
    const onSettled = vi.fn();
    const onScrollStateChange = vi.fn();
    const virtualizer = { ...baseVirtualizer(), scrollOffset: undefined };
    run(
      { settled: true, previousOffset: 5, virtualizer },
      { settleTime: 10, onSettled, onScrollStateChange }
    );
    expect(onSettled).toHaveBeenCalled();
    expect(mocks.setSettled).toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(100);
    expect(onScrollStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ scrollTop: 0, listContextParams: context })
    );
    vi.advanceTimersByTime(10);
    expect(mocks.setSettled).toHaveBeenCalledWith(true);
    for (const cleanup of mocks.cleanups) cleanup();
    mocks.cleanups = [];

    run({ paging: basePaging({ scope: 'stale' }) }, { onScrollStateChange });
    run({}, {});
  });

  it('dispatches reach and estimate transitions for all completion states', () => {
    run({ rows: { ...baseRows(), atStart: true, atEnd: true, rowsLength: 3 } });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'REACHED_START' });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'REACHED_END' });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ESTIMATED_TOTAL',
      newTotal: 3,
    });

    run({
      paging: { ...basePaging(), estimatedTotal: 1 },
      rows: { ...baseRows(), atStart: false, atEnd: false, firstRowIndex: 5 },
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ESTIMATED_TOTAL',
      newTotal: 9,
    });

    run({
      paging: { ...basePaging(), estimatedTotal: 99 },
      rows: { ...baseRows(), complete: true, atStart: false, atEnd: false },
    });
    run({ rows: { ...baseRows(), complete: false, atStart: true, atEnd: true } });
  });

  it('applies pending scroll adjustments and every row-window correction', () => {
    const call = run({
      paging: { ...basePaging(), pendingScrollAdjustment: 2 },
      virtualizer: { ...baseVirtualizer(), scrollOffset: undefined },
    });
    expect(call.scenario.virtualizer.scrollToOffset).toHaveBeenCalledWith(40);
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'SCROLL_ADJUSTED' });

    run({ rows: { ...baseRows(), rowsEmpty: true } });
    run({ paging: basePaging({ scope: 'stale' }) });
    run({ paging: { ...basePaging(), pagingPhase: 'skipping' } });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'PAGING_COMPLETE' });

    run({
      rows: { ...baseRows(), firstRowIndex: -3, atStart: false },
    });
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHIFT_ANCHOR_DOWN', offset: 4 })
    );

    run({ rows: { ...baseRows(), firstRowIndex: -2, atStart: true } });
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHIFT_ANCHOR_DOWN', offset: 2 })
    );

    run({ rows: { ...baseRows(), firstRowIndex: 3, atStart: true } });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'RESET_TO_TOP', offset: -3 });
    run({ rows: { ...baseRows(), firstRowIndex: 0, atStart: true } });
  });

  it('restores persisted, permalink, and top positions', () => {
    const restored = {
      anchor: { index: 2, kind: 'backward' },
      scrollTop: 25,
      estimatedTotal: 8,
      hasReachedStart: true,
      hasReachedEnd: false,
      listContextParams: context,
    };
    let call = run(
      { hasAppliedScrollOverride: true, appliedScrollInitial: null },
      { scrollState: restored }
    );
    expect(call.scenario.virtualizer.scrollToOffset).toHaveBeenCalledWith(25);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESET_STATE' }));

    const foundVirtualizer = {
      ...baseVirtualizer(),
      getVirtualItems: vi.fn(() => [{ index: 1 }, { index: 4 }]),
    };
    run(
      {
        paging: basePaging({ scope: 'stale' }),
        virtualizer: foundVirtualizer,
        rows: {
          ...baseRows(),
          rowAt: (index: number) => (index === 4 ? { id: 'target' } : undefined),
        },
      },
      { permalinkID: 'target', getRowKey: (row: any) => row.id }
    );
    expect(foundVirtualizer.scrollToIndex).toHaveBeenCalledWith(4, { align: 'auto' });

    call = run(
      { paging: basePaging({ scope: 'stale' }) },
      { permalinkID: 'missing', getRowKey: (row: any) => row.id }
    );
    expect(call.scenario.virtualizer.scrollToOffset).toHaveBeenCalledWith(20);

    call = run(
      { paging: basePaging({ scope: 'stale' }) },
      { permalinkID: 'missing-with-default-key' }
    );
    expect(call.scenario.virtualizer.scrollToOffset).toHaveBeenCalledWith(20);

    call = run({ paging: basePaging({ scope: 'stale' }) });
    expect(call.scenario.virtualizer.scrollToOffset).toHaveBeenCalledWith(0);
  });

  it('reports totals for complete and fully reached windows', () => {
    expect(
      run({ rows: { ...baseRows(), atStart: true, atEnd: true, rowsLength: 6 } }).result.total
    ).toBe(6);
    expect(
      run({ paging: { ...basePaging(), hasReachedStart: true, hasReachedEnd: true } }).result.total
    ).toBe(10);
    expect(run({}, { count: 12 }).result.total).toBe(12);
  });

  it('updates anchors near both page edges and skips every stale state', () => {
    const backwardVirtualizer = {
      ...baseVirtualizer(),
      getVirtualItems: vi.fn(() => [{ index: 0 }, { index: 1 }]),
    };
    run({ virtualizer: backwardVirtualizer, pageSize: 10 });
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_ANCHOR',
        anchor: expect.objectContaining({ kind: 'backward' }),
      })
    );

    const forwardVirtualizer = {
      ...baseVirtualizer(),
      getVirtualItems: vi.fn(() => [{ index: 2 }, { index: 3 }]),
    };
    run({
      rows: { ...baseRows(), atStart: true, atEnd: false },
      virtualizer: forwardVirtualizer,
      pageSize: 10,
    });
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_ANCHOR',
        anchor: expect.objectContaining({ kind: 'forward' }),
      })
    );

    run({ paging: basePaging({ scope: 'stale' }), virtualizer: backwardVirtualizer });
    run({ virtualizer: { ...baseVirtualizer(), getVirtualItems: vi.fn(() => []) } });
    run({ rows: { ...baseRows(), complete: false }, virtualizer: backwardVirtualizer });
    run({
      paging: { ...basePaging(), pagingPhase: 'adjusting' },
      virtualizer: backwardVirtualizer,
    });
    run({
      paging: { ...basePaging(), pendingScrollAdjustment: 1 },
      virtualizer: backwardVirtualizer,
    });
    run({ awaitingInitial: true, virtualizer: backwardVirtualizer });
    run({
      rows: { ...baseRows(), atStart: true, firstRowIndex: 2 },
      virtualizer: backwardVirtualizer,
    });
    run({
      rows: { ...baseRows(), atStart: true, firstRowIndex: 0, atEnd: true },
      virtualizer: backwardVirtualizer,
    });
    run({
      rowMissing: true,
      rows: { ...baseRows(), atStart: true, atEnd: false },
      virtualizer: forwardVirtualizer,
      pageSize: 10,
    });
    run({
      rows: { ...baseRows(), rowsLength: 0, atStart: false, atEnd: false },
      virtualizer: backwardVirtualizer,
      pageSize: 10,
    });
  });
});
