/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchListContext } from '../../types/search-document.types';

const mocks = vi.hoisted(() => ({
  useZeroVirtualizer: vi.fn(),
  usePolityZeroGrid: vi.fn(),
}));

vi.mock('@rocicorp/zero-virtual/react', () => ({
  useHistoryScrollState: () => [null, vi.fn()],
  useZeroVirtualizer: mocks.useZeroVirtualizer,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[]],
}));

vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroGrid: mocks.usePolityZeroGrid,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    search: {
      searchDocumentPage: vi.fn(() => ({})),
      searchDocumentById: vi.fn(() => ({})),
    },
  },
}));

import { useSpatialSearchController } from '../useSpatialSearchController';
import { useStableSearchListContext } from '../useStableSearchListContext';
import {
  getSearchGridLanes,
  useVirtualSearchGridController,
} from '../useVirtualSearchGridController';

const context: SearchListContext = {
  query: '',
  types: [],
  topics: [],
  createdAfter: null,
  engagement: 'all',
  sort: 'recent',
  snapshotAt: null,
};

describe('search virtualizer controller contracts', () => {
  beforeEach(() => {
    mocks.useZeroVirtualizer.mockReset();
    mocks.usePolityZeroGrid.mockReset();
    mocks.usePolityZeroGrid.mockReturnValue({
      virtualizer: {
        getVirtualItems: () => [],
        getTotalSize: () => 0,
        scrollToIndex: vi.fn(),
      },
      rowAt: vi.fn(),
      complete: true,
      rowsEmpty: true,
      total: 0,
    });

    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      }
    );
  });

  it('preserves list-context identity when only array references change', () => {
    let nextContext = context;
    const { result, rerender } = renderHook(() => useStableSearchListContext(nextContext));
    const initial = result.current;

    nextContext = { ...context, types: [], topics: [] };
    rerender();

    expect(result.current).toBe(initial);
  });

  it('consumes the zero-virtual 0.6 snapshot without a virtualizer property', () => {
    mocks.useZeroVirtualizer.mockReturnValue({
      items: [{ index: 2, key: 'row-2', row: undefined }],
      spaceBefore: 720,
      spaceAfter: 360,
      complete: false,
      rowsEmpty: false,
      total: undefined,
    });

    const { result } = renderHook(() => useSpatialSearchController({ context }));

    expect(result.current.cells).toEqual([{ index: 2, key: 'row-2', document: undefined }]);
    expect(result.current.spaceBefore).toBe(720);
    expect(result.current.spaceAfter).toBe(360);
  });

  it('routes the responsive grid through the shared grid adapter', () => {
    const virtualizer = {
      getVirtualItems: () => [],
      getTotalSize: () => 0,
      scrollToIndex: vi.fn(),
    };
    mocks.usePolityZeroGrid.mockReturnValue({
      virtualizer,
      rowAt: vi.fn(),
      complete: true,
      rowsEmpty: true,
      total: 0,
    });

    const { result } = renderHook(() => useVirtualSearchGridController({ context }));

    expect(mocks.usePolityZeroGrid).toHaveBeenCalled();
    const options = mocks.usePolityZeroGrid.mock.calls.at(-1)?.[0];
    expect(options.overscan).toBe(2);
    expect(options.minPageSize).toBe(18);
    expect(options.maxPageSize).toBe(48);
    expect(options.useFlushSync).toBe(false);
    expect(options.estimateSize()).toBe(376);
    expect(result.current.cells).toEqual([]);
    expect(result.current.totalHeight).toBe(0);
    expect(result.current).not.toHaveProperty('onScroll');
    expect(result.current).not.toHaveProperty('onMeasureElement');
  });

  it('keeps the responsive one-to-four lane breakpoints', () => {
    expect([
      getSearchGridLanes(699),
      getSearchGridLanes(700),
      getSearchGridLanes(1040),
      getSearchGridLanes(1440),
    ]).toEqual([1, 2, 3, 4]);
  });
});
