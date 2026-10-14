/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSearchURL = vi.hoisted(() => vi.fn());

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[]],
}));

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    search: {
      searchDocumentTopics: vi.fn(),
    },
  },
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({ userHashtags: [] }),
}));

vi.mock('../useSearchURL', () => ({
  useSearchURL: mockUseSearchURL,
}));

import { useSearchPage } from '../useSearchPage';

function makeSearchURLState(searchQuery: string) {
  return {
    searchQuery,
    setSearchQuery: vi.fn(),
    contentTypes: [],
    setContentTypes: vi.fn(),
    dateRange: 'all' as const,
    setDateRange: vi.fn(),
    topics: [],
    setTopics: vi.fn(),
    engagement: 'all' as const,
    setEngagement: vi.fn(),
    sortBy: 'recent' as const,
    view: 'list' as const,
    setView: vi.fn(),
  };
}

describe('useSearchPage result totals', () => {
  beforeEach(() => {
    mockUseSearchURL.mockReset();
  });

  it('settles repeated result-count reports without a render feedback loop', () => {
    mockUseSearchURL.mockReturnValue(makeSearchURLState('K1'));
    let renders = 0;
    const { result, unmount } = renderHook(() => {
      const search = useSearchPage();
      renders++;
      // Virtual result observers may report the same count after a layout update.
      useLayoutEffect(() => search.setTotalResults(12));
      return search;
    });
    expect(result.current.totalResults).toBe(12);
    expect(renders).toBeLessThan(5);
    unmount();
  });

  it('invalidates an exact total synchronously when the search context changes', () => {
    let searchURLState = makeSearchURLState('K1');
    mockUseSearchURL.mockImplementation(() => searchURLState);

    const { result, rerender, unmount } = renderHook(() => useSearchPage());

    act(() => result.current.setTotalResults(12));
    expect(result.current.totalResults).toBe(12);

    searchURLState = makeSearchURLState('K2');
    rerender();

    expect(result.current.totalResults).toBeNull();
    unmount();
  });

  it('does not render again for an unchanged unknown count, including a new context', () => {
    let searchURLState = makeSearchURLState('K1');
    mockUseSearchURL.mockImplementation(() => searchURLState);
    let renders = 0;
    const { result, rerender, unmount } = renderHook(() => {
      renders++;
      return useSearchPage();
    });
    const initialRenders = renders;
    act(() => result.current.setTotalResults(null));
    expect(renders).toBe(initialRenders);
    expect(result.current.totalResults).toBeNull();

    searchURLState = makeSearchURLState('K2');
    rerender();
    const changedContextRenders = renders;
    act(() => result.current.setTotalResults(null));
    expect(renders).toBe(changedContextRenders);
    expect(result.current.totalResults).toBeNull();
    unmount();
  });

  it('clears an earlier exact count when a different context reports unknown', () => {
    let searchURLState = makeSearchURLState('K1');
    mockUseSearchURL.mockImplementation(() => searchURLState);
    const { result, rerender, unmount } = renderHook(() => useSearchPage());
    act(() => result.current.setTotalResults(12));
    expect(result.current.totalResults).toBe(12);
    searchURLState = makeSearchURLState('K2');
    rerender();
    expect(result.current.totalResults).toBeNull();
    act(() => result.current.setTotalResults(null));
    searchURLState = makeSearchURLState('K1');
    rerender();
    expect(result.current.totalResults).toBeNull();
    unmount();
  });

  it('binds the same exact count to a different context and accepts zero', () => {
    let searchURLState = makeSearchURLState('K1');
    mockUseSearchURL.mockImplementation(() => searchURLState);
    const { result, rerender, unmount } = renderHook(() => useSearchPage());
    act(() => result.current.setTotalResults(12));
    searchURLState = makeSearchURLState('K2');
    rerender();
    expect(result.current.totalResults).toBeNull();
    act(() => result.current.setTotalResults(12));
    expect(result.current.totalResults).toBe(12);
    act(() => result.current.setTotalResults(0));
    expect(result.current.totalResults).toBe(0);
    unmount();
  });

  it('keeps reports from a previous context scoped to that context', () => {
    let searchURLState = makeSearchURLState('K1');
    mockUseSearchURL.mockImplementation(() => searchURLState);
    const { result, rerender, unmount } = renderHook(() => useSearchPage());
    const previousReport = result.current.setTotalResults;
    searchURLState = makeSearchURLState('K2');
    rerender();
    const currentReport = result.current.setTotalResults;
    act(() => currentReport(3));
    expect(result.current.totalResults).toBe(3);
    act(() => previousReport(12));
    expect(result.current.totalResults).toBeNull();
    act(() => currentReport(3));
    expect(result.current.totalResults).toBe(3);
    unmount();
  });
});
