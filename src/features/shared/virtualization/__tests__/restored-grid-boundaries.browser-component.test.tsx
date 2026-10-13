import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useZeroGridVirtualizer } from '../grid-runtime/use-zero-grid-virtualizer';

const fixture = vi.hoisted(() => ({
  result: { type: 'unknown' },
  rows: [{ id: 'cached' }],
  renders: 0,
  childRenders: 0,
  actions: [] as { type: string; previous: boolean }[],
}));

vi.mock('@/zero/observed-query', () => ({
  useQuery: (query: unknown) => [query ? fixture.rows : undefined, fixture.result],
}));
vi.mock('../grid-runtime/paging-reducer', async importOriginal => {
  const original = await importOriginal<{
    pagingReducer: (
      state: Record<string, unknown>,
      action: { type: string }
    ) => Record<string, unknown>;
  }>();
  return {
    pagingReducer: (state: Record<string, unknown>, action: { type: string }) => {
      if (action.type === 'REACHED_START' || action.type === 'REACHED_END') {
        fixture.actions.push({
          type: action.type,
          previous: Boolean(
            action.type === 'REACHED_START' ? state.hasReachedStart : state.hasReachedEnd
          ),
        });
      }
      return original.pagingReducer(state, action);
    },
  };
});

const context = { query: 'cached search' };
const restoredState = {
  listContextParams: context,
  scrollTop: 0,
  estimatedTotal: 1,
  hasReachedStart: true,
  hasReachedEnd: true,
  anchor: { kind: 'forward', index: 0 },
};
const page = () => ({ query: 'cached-page' });
const single = () => ({ query: 'single' });
const rowKey = (row: { id: string }) => row.id;
const startRow = (row: { id: string }) => ({ id: row.id });

interface RenderedGrid {
  virtualizer: {
    getTotalSize: () => number;
    getVirtualItems: () => { key: string | number; index: number; start: number }[];
  };
  rowAt: (index: number) => { id: string } | undefined;
}

function Grid({
  listContext = context,
  scrollState = restoredState,
  onScrollStateChange = undefined,
}: {
  listContext?: typeof context;
  scrollState?: typeof restoredState;
  onScrollStateChange?: (state: typeof restoredState) => void;
}) {
  fixture.renders++;
  const ref = useRef<HTMLDivElement>(null);
  const grid = useZeroGridVirtualizer({
    listContextParams: listContext,
    getScrollElement: useCallback(() => ref.current, []),
    estimateSize: useCallback(() => 40, []),
    overscan: 0,
    minPageSize: 2,
    maxPageSize: 2,
    getPageQuery: page,
    getSingleQuery: single,
    getRowKey: rowKey,
    toStartRow: startRow,
    initialRect: { width: 600, height: 160 },
    scrollState,
    onScrollStateChange,
  }) as RenderedGrid;
  return <GridBody grid={grid} scrollRef={ref} />;
}

function GridBody({
  grid,
  scrollRef,
}: {
  grid: RenderedGrid;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  fixture.childRenders++;
  return (
    <div
      ref={scrollRef}
      data-testid="grid"
      style={{ width: 600, height: 160, overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: grid.virtualizer.getTotalSize() }}>
        {grid.virtualizer.getVirtualItems().map(item => (
          <div key={item.key} style={{ position: 'absolute', top: item.start }}>
            {grid.rowAt(item.index)?.id ?? 'loading'}
          </div>
        ))}
      </div>
    </div>
  );
}

beforeEach(() => {
  fixture.result = { type: 'unknown' };
  fixture.renders = 0;
  fixture.childRenders = 0;
  fixture.actions = [];
});
afterEach(cleanup);

it('renders a restored cached grid once without reporting already reached boundaries', async () => {
  render(<Grid />);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  expect(screen.getByTestId('grid').getBoundingClientRect().width).toBe(600);
  expect(screen.getByTestId('grid').getBoundingClientRect().height).toBe(160);
  expect(screen.getByText('cached')).toBeVisible();
  expect(fixture.actions).toEqual([]);
  expect(fixture.renders).toBe(1);
  expect(fixture.childRenders).toBe(1);
});

it('reports real start and end transitions as cached data becomes authoritative', async () => {
  const onScrollStateChange = vi.fn();
  const scrollState = { ...restoredState, hasReachedStart: false, hasReachedEnd: false };
  const view = render(<Grid scrollState={scrollState} onScrollStateChange={onScrollStateChange} />);
  expect(fixture.actions).toEqual([{ type: 'REACHED_START', previous: false }]);
  await waitFor(() =>
    expect(onScrollStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasReachedStart: true, hasReachedEnd: false })
    )
  );

  fixture.result = { type: 'complete' };
  view.rerender(<Grid scrollState={scrollState} onScrollStateChange={onScrollStateChange} />);
  expect(fixture.actions).toEqual([
    { type: 'REACHED_START', previous: false },
    { type: 'REACHED_END', previous: false },
  ]);
  await waitFor(() =>
    expect(onScrollStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasReachedStart: true, hasReachedEnd: true })
    )
  );
  expect(screen.getByText('cached')).toBeVisible();
});

it('reasserts a boundary after a context reset even when atStart stays true', async () => {
  const onScrollStateChange = vi.fn();
  const view = render(<Grid onScrollStateChange={onScrollStateChange} />);
  expect(fixture.actions).toEqual([]);
  const nextContext = { query: 'different cached search' };
  const nextScrollState = {
    ...restoredState,
    listContextParams: nextContext,
    hasReachedStart: false,
    hasReachedEnd: false,
  };
  view.rerender(
    <Grid
      listContext={nextContext}
      scrollState={nextScrollState}
      onScrollStateChange={onScrollStateChange}
    />
  );
  expect(fixture.actions).toEqual([{ type: 'REACHED_START', previous: false }]);
  await waitFor(() =>
    expect(onScrollStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        listContextParams: nextContext,
        hasReachedStart: true,
        hasReachedEnd: false,
      })
    )
  );
  expect(screen.getByText('cached')).toBeVisible();
});

it('reasserts both boundaries when another history entry resets flags without changing the rows', async () => {
  fixture.result = { type: 'complete' };
  const onScrollStateChange = vi.fn();
  const view = render(<Grid onScrollStateChange={onScrollStateChange} />);
  expect(fixture.actions).toEqual([]);
  const nextScrollState = { ...restoredState, hasReachedStart: false, hasReachedEnd: false };
  view.rerender(<Grid scrollState={nextScrollState} onScrollStateChange={onScrollStateChange} />);
  expect(fixture.actions).toEqual([
    { type: 'REACHED_START', previous: false },
    { type: 'REACHED_END', previous: false },
  ]);
  await waitFor(() =>
    expect(onScrollStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        listContextParams: context,
        hasReachedStart: true,
        hasReachedEnd: true,
      })
    )
  );
  expect(screen.getByText('cached')).toBeVisible();
});
