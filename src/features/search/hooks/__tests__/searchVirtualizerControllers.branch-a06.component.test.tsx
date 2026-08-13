/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchDocument, SearchListContext } from '../../types/search-document.types';

const mocks = vi.hoisted(() => ({
  useZeroVirtualizer: vi.fn(),
  usePolityZeroGrid: vi.fn(),
  useQuery: vi.fn(),
  pageQuery: vi.fn(),
  byIdQuery: vi.fn(),
  useSearchCardState: vi.fn(),
  useProgressiveSearchCards: vi.fn(),
}));

vi.mock('@rocicorp/zero-virtual/react', () => ({
  useHistoryScrollState: () => [null, vi.fn()],
  useZeroVirtualizer: mocks.useZeroVirtualizer,
}));
vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroGrid: mocks.usePolityZeroGrid,
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    search: {
      searchDocumentPage: mocks.pageQuery,
      searchDocumentById: mocks.byIdQuery,
    },
  },
}));
vi.mock('../../SearchCardStateProvider', () => ({
  useSearchCardState: mocks.useSearchCardState,
}));
vi.mock('../useProgressiveSearchCards', () => ({
  useProgressiveSearchCards: mocks.useProgressiveSearchCards,
}));

import { useSpatialSearchController } from '../useSpatialSearchController';
import { useVirtualSearchGridController } from '../useVirtualSearchGridController';

const context: SearchListContext = {
  query: '',
  types: [],
  topics: [],
  createdAfter: null,
  engagement: 'all',
  sort: 'recent',
  snapshotAt: null,
};

function document(id: string, overrides: Partial<SearchDocument> = {}): SearchDocument {
  return {
    id,
    entity_id: id,
    entity_type: 'event',
    title: id,
    location_latitude: 50,
    location_longitude: 10,
    location_label: id,
    location_source: 'event',
    card_payload: { type: 'event' },
    created_at: 1,
    engagement_score: 2,
    trending_score: 3,
    ...overrides,
  } as SearchDocument;
}

let resizeCallback: ResizeObserverCallback | undefined;
let animationCallback: FrameRequestCallback | undefined;
const resizeDisconnect = vi.fn();
const scrollToIndex = vi.fn();
const first = document('first');
const second = document('second', { location_latitude: 52, location_longitude: 12 });
let gridHead = first;
let latestGridController: ReturnType<typeof useVirtualSearchGridController> | undefined;

function GridProbe({
  tick = 0,
  onTotalChange,
}: {
  tick?: number;
  onTotalChange?: (value: number | null) => void;
}) {
  latestGridController = useVirtualSearchGridController({
    context: { ...context, query: String(tick) },
    permalinkID: 'first',
    onTotalChange,
  });
  return (
    <>
      <div data-testid="scroll-parent" ref={latestGridController.parentRef} />
      <output data-testid="new-results">{String(latestGridController.showNewResults)}</output>
    </>
  );
}

describe('search virtualizer controller branch matrix', () => {
  beforeEach(() => {
    resizeCallback = undefined;
    animationCallback = undefined;
    gridHead = first;
    latestGridController = undefined;
    resizeDisconnect.mockReset();
    scrollToIndex.mockReset();
    mocks.useZeroVirtualizer.mockReset();
    mocks.usePolityZeroGrid.mockReset();
    mocks.useQuery.mockReset();
    mocks.pageQuery.mockReset();
    mocks.byIdQuery.mockReset();
    mocks.useSearchCardState.mockReset();
    mocks.useProgressiveSearchCards.mockReset();
    mocks.pageQuery.mockImplementation(input => ({ kind: 'page', input }));
    mocks.byIdQuery.mockImplementation(input => ({ kind: 'single', input }));
    mocks.useQuery.mockReturnValue([[first, second]]);
    mocks.useSearchCardState.mockReturnValue({ isReady: true });
    mocks.useProgressiveSearchCards.mockReturnValue(new Set(['first']));
    mocks.useZeroVirtualizer.mockReturnValue({
      items: [
        { key: 'first', index: 0, row: first },
        { key: 'missing', index: 1, row: undefined },
      ],
      spaceBefore: 10,
      spaceAfter: 20,
      complete: false,
      rowsEmpty: false,
      total: undefined,
    });
    mocks.usePolityZeroGrid.mockImplementation(() => ({
      virtualizer: {
        getVirtualItems: () => [
          { key: 'first', index: 0, start: 5, lane: undefined },
          { key: 'missing', index: 1, start: 10, lane: 1 },
        ],
        getTotalSize: () => 800,
        scrollToIndex,
      },
      rowAt: (index: number) => (index === 0 ? gridHead : undefined),
      complete: false,
      rowsEmpty: false,
      total: undefined,
    }));

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe() {
          return undefined;
        }
        disconnect() {
          resizeDisconnect();
        }
      }
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      animationCallback = callback;
      return 17;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds spatial queries for settled and live pages and reports totals', () => {
    const onTotalChange = vi.fn();
    const { result } = renderHook(() =>
      useSpatialSearchController({ context, permalinkID: 'first', onTotalChange })
    );
    const options = mocks.useZeroVirtualizer.mock.calls.at(-1)?.[0];

    expect(
      options.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true })
    ).toMatchObject({
      options: { ttl: '5m' },
    });
    expect(
      options.getPageQuery({ limit: 5, start: null, dir: 'backward', settled: false })
    ).toMatchObject({
      options: { ttl: 'none' },
    });
    expect(options.getSingleQuery({ id: 'first', settled: true })).toMatchObject({
      options: { ttl: '5m' },
    });
    expect(options.getSingleQuery({ id: 'first', settled: false })).toMatchObject({
      options: { ttl: 'none' },
    });
    expect(options.getRowKey(first)).toBe('first');
    expect(options.toStartRow(first)).toEqual({
      id: 'first',
      created_at: 1,
      engagement_score: 2,
      trending_score: 3,
    });
    expect(options.getScrollElement()).toBeNull();
    expect(options.estimateSize()).toBe(376);
    expect(onTotalChange).toHaveBeenCalledWith(null);
    expect(result.current.mapCenter).toEqual([51, 11]);
    expect(result.current.activeMapItem?.id).toBe('first');
    expect(result.current.cells).toHaveLength(2);
  });

  it('handles all bounds comparisons, empty maps and optional total callbacks', () => {
    mocks.useQuery.mockReturnValue([[]]);
    const { result } = renderHook(() => useSpatialSearchController({ context }));
    expect(result.current.mapCenter).toEqual([51.1657, 10.4515]);
    expect(result.current.activeMapItem).toBeNull();
    act(() => result.current.onMapItemSelect('without-mounted-parent'));

    const base = { north: 55.2, south: 47.2, east: 15.5, west: 5.5 };
    act(() => result.current.onBoundsChange(base));
    act(() => result.current.onBoundsChange({ ...base, north: 54 }));
    act(() => result.current.onBoundsChange({ ...base, north: 54, south: 46 }));
    act(() => result.current.onBoundsChange({ ...base, north: 54, south: 46, east: 14 }));
    act(() => result.current.onBoundsChange({ north: 54, south: 46, east: 14, west: 4 }));
  });

  it('selects map and list documents and scrolls a matching DOM row', () => {
    const { result } = renderHook(() => useSpatialSearchController({ context }));
    const parent = documentNode();
    (result.current.parentRef as MutableRefObject<HTMLDivElement | null>).current = parent;
    const row = window.document.createElement('div');
    row.dataset.searchDocumentId = 'second';
    row.scrollIntoView = vi.fn();
    parent.append(row);

    act(() => result.current.onMapItemSelect('second'));
    expect(result.current.activeDocumentId).toBe('second');
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    act(() => result.current.onMapItemSelect('absent'));
    act(() => result.current.onDocumentSelect(first));
    expect(result.current.activeDocumentId).toBe('first');
    act(() => result.current.onActiveDocumentChange(null));
    expect(result.current.activeDocumentId).toBeNull();
  });

  it('observes grid size, builds both TTL query forms and maps preview and interactive cells', () => {
    const onTotalChange = vi.fn();
    render(<GridProbe onTotalChange={onTotalChange} />);
    expect(resizeCallback).toBeDefined();
    act(() => resizeCallback?.([], {} as ResizeObserver));
    act(() =>
      resizeCallback?.(
        [{ contentRect: { width: 1_100 } } as ResizeObserverEntry],
        {} as ResizeObserver
      )
    );

    const options = mocks.usePolityZeroGrid.mock.calls.at(-1)?.[0];
    expect(
      options.getPageQuery({ limit: 9, start: null, dir: 'forward', settled: true }).options.ttl
    ).toBe('5m');
    expect(
      options.getPageQuery({ limit: 9, start: null, dir: 'forward', settled: false }).options.ttl
    ).toBe('none');
    expect(options.getSingleQuery({ id: 'first', settled: true }).options.ttl).toBe('5m');
    expect(options.getSingleQuery({ id: 'first', settled: false }).options.ttl).toBe('none');
    expect(options.getRowKey(first)).toBe('first');
    expect(options.toStartRow(first).id).toBe('first');
    expect(options.getScrollElement()).toBe(screen.getByTestId('scroll-parent'));
    expect(latestGridController?.cells.map(cell => cell.mode)).toEqual(['interactive', 'preview']);
    expect(latestGridController?.cells[0]?.left).toBe(0);
    expect(onTotalChange).toHaveBeenCalledWith(null);
    expect(mocks.useProgressiveSearchCards).toHaveBeenLastCalledWith(
      expect.objectContaining({ stateReady: true, documentIds: ['first'] })
    );
  });

  it('flags a changed head while scrolled away, clears it near the top and jumps to index zero', () => {
    const view = render(<GridProbe />);
    const parent = screen.getByTestId('scroll-parent');
    Object.defineProperty(parent, 'scrollTop', { value: 500, writable: true });
    fireEvent.scroll(parent);
    act(() => animationCallback?.(0));

    gridHead = second;
    view.rerender(<GridProbe tick={1} />);
    expect(screen.getByTestId('new-results').textContent).toBe('true');

    parent.scrollTop = 0;
    fireEvent.scroll(parent);
    act(() => animationCallback?.(0));
    expect(screen.getByTestId('new-results').textContent).toBe('false');

    act(() => latestGridController?.onJumpToTop());
    expect(scrollToIndex).toHaveBeenCalledWith(0, { align: 'start' });
    view.unmount();
    expect(resizeDisconnect).toHaveBeenCalled();
  });

  it('coalesces scroll frames and cancels a pending frame during cleanup', () => {
    const view = render(<GridProbe />);
    const parent = screen.getByTestId('scroll-parent');
    fireEvent.scroll(parent);
    fireEvent.scroll(parent);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(17);
  });
});

function documentNode() {
  return window.document.createElement('div');
}
