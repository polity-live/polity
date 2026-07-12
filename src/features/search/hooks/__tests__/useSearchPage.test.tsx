/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
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

  it('invalidates an exact total synchronously when the search context changes', () => {
    let searchURLState = makeSearchURLState('K1');
    mockUseSearchURL.mockImplementation(() => searchURLState);

    const { result, rerender } = renderHook(() => useSearchPage());

    act(() => result.current.setTotalResults(12));
    expect(result.current.totalResults).toBe(12);

    searchURLState = makeSearchURLState('K2');
    rerender();

    expect(result.current.totalResults).toBeNull();
  });
});
