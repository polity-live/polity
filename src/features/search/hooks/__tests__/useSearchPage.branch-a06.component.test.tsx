/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_CONTENT_TYPES } from '@/features/timeline/hooks/useTimelineFilters';

const mocks = vi.hoisted(() => ({
  useSearchURL: vi.fn(),
  useQuery: vi.fn(),
  useSearch: vi.fn(),
  useAuth: vi.fn(),
  searchDocumentTopics: vi.fn(),
  useUserHashtagsState: vi.fn(),
  extractHashtagTags: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('@tanstack/react-router', () => ({ useSearch: mocks.useSearch }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/zero/queries', () => ({
  queries: { search: { searchDocumentTopics: mocks.searchDocumentTopics } },
}));
vi.mock('@/zero/common/useUserHashtagsState', () => ({
  useUserHashtagsState: mocks.useUserHashtagsState,
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: mocks.extractHashtagTags,
}));
vi.mock('../useSearchURL', () => ({ useSearchURL: mocks.useSearchURL }));

import { useSearchPage } from '../useSearchPage';

function urlState(overrides: Record<string, unknown> = {}) {
  return {
    searchQuery: '',
    setSearchQuery: vi.fn(),
    contentTypes: [...ALL_CONTENT_TYPES],
    setContentTypes: vi.fn(),
    dateRange: 'all',
    setDateRange: vi.fn(),
    topics: [],
    setTopics: vi.fn(),
    engagement: 'all',
    setEngagement: vi.fn(),
    sortBy: 'recent',
    view: 'list',
    setView: vi.fn(),
    ...overrides,
  };
}

describe('useSearchPage branch matrix', () => {
  let idleCallback: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
    idleCallback = undefined;
    mocks.useSearchURL.mockReset();
    mocks.useQuery.mockReset();
    mocks.useSearch.mockReset();
    mocks.useAuth.mockReset();
    mocks.searchDocumentTopics.mockReset();
    mocks.useUserHashtagsState.mockReset();
    mocks.extractHashtagTags.mockReset();
    mocks.useSearchURL.mockReturnValue(urlState());
    mocks.useQuery.mockReturnValue([[]]);
    mocks.useSearch.mockReturnValue({});
    mocks.useAuth.mockReturnValue({ user: { id: 'user-1' } });
    mocks.searchDocumentTopics.mockReturnValue({ query: 'topics' });
    mocks.useUserHashtagsState.mockReturnValue({ userHashtags: [] });
    mocks.extractHashtagTags.mockReturnValue([]);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      idleCallback = callback;
      return 2;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('defers auxiliary topic queries until idle and passes the authenticated user', () => {
    renderHook(() => useSearchPage());
    expect(mocks.useQuery).toHaveBeenCalledWith(undefined);
    expect(mocks.useUserHashtagsState).toHaveBeenCalledWith(undefined);

    act(() => idleCallback?.());
    expect(mocks.searchDocumentTopics).toHaveBeenCalledWith({ limit: 160 });
    expect(mocks.useUserHashtagsState).toHaveBeenLastCalledWith('user-1');
  });

  it('uses and cleans up the timer fallback when requestIdleCallback is unavailable', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('cancelIdleCallback', undefined);
    const view = renderHook(() => useSearchPage());
    expect(mocks.searchDocumentTopics).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(mocks.searchDocumentTopics).toHaveBeenCalled();
    view.unmount();
  });

  it('cancels idle work on cleanup', () => {
    const view = renderHook(() => useSearchPage());
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(cancelIdleCallback).toHaveBeenCalledWith(2);
  });

  it('deduplicates personal and discovered topics case-insensitively and caps them', () => {
    const personal = ['Local', ...Array.from({ length: 85 }, (_, index) => `personal-${index}`)];
    mocks.extractHashtagTags.mockReturnValue(personal);
    mocks.useQuery.mockReturnValue([[{ topic: 'local' }, { topic: 'New' }, { topic: 'NEW' }]]);
    const { result } = renderHook(() => useSearchPage());

    expect(result.current.personalTopics).toEqual(personal);
    expect(result.current.availableTopics).toHaveLength(80);
    expect(result.current.availableTopics[0]).toBe('Local');
    expect(
      result.current.availableTopics.filter(topic => topic.toLowerCase() === 'local')
    ).toHaveLength(1);
  });

  it('treats an unavailable topic query result as an empty list', () => {
    mocks.useQuery.mockReturnValue([undefined]);
    const { result } = renderHook(() => useSearchPage());
    expect(result.current.availableTopics).toEqual([]);
  });

  it('toggles selected and unselected content types and topics', () => {
    const state = urlState({ contentTypes: [ALL_CONTENT_TYPES[0]], topics: ['local'] });
    mocks.useSearchURL.mockReturnValue(state);
    const { result } = renderHook(() => useSearchPage());

    act(() => result.current.toggleContentType(ALL_CONTENT_TYPES[0]));
    expect(state.setContentTypes).toHaveBeenLastCalledWith([]);
    act(() => result.current.toggleContentType(ALL_CONTENT_TYPES[1]));
    expect(state.setContentTypes).toHaveBeenLastCalledWith([
      ALL_CONTENT_TYPES[0],
      ALL_CONTENT_TYPES[1],
    ]);

    act(() => result.current.toggleTopic('local'));
    expect(state.setTopics).toHaveBeenLastCalledWith([]);
    act(() => result.current.toggleTopic('federal'));
    expect(state.setTopics).toHaveBeenLastCalledWith(['local', 'federal']);
  });

  it('resets every filter to its default', () => {
    const state = urlState({ searchQuery: 'query' });
    mocks.useSearchURL.mockReturnValue(state);
    const { result } = renderHook(() => useSearchPage());
    act(() => result.current.resetFilters());

    expect(state.setSearchQuery).toHaveBeenCalledWith('');
    expect(state.setContentTypes).toHaveBeenCalledWith(ALL_CONTENT_TYPES);
    expect(state.setDateRange).toHaveBeenCalledWith('all');
    expect(state.setTopics).toHaveBeenCalledWith([]);
    expect(state.setEngagement).toHaveBeenCalledWith('all');
  });

  it.each([
    { contentTypes: [ALL_CONTENT_TYPES[0]] },
    { dateRange: 'week' },
    { topics: ['topic'] },
    { engagement: 'popular' },
    { searchQuery: ' query ' },
  ])('detects each active filter condition', override => {
    mocks.useSearchURL.mockReturnValue(urlState(override));
    const { result } = renderHook(() => useSearchPage());
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('reports no active filters for exact defaults and normalizes all selected types to an empty context list', () => {
    const { result } = renderHook(() => useSearchPage());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.searchContext.types).toEqual([]);
  });

  it.each([
    ['today', new Date(2026, 7, 9).getTime()],
    ['week', new Date('2026-08-09T12:00:00Z').getTime() - 7 * 86_400_000],
    ['month', new Date('2026-08-09T12:00:00Z').getTime() - 30 * 86_400_000],
    ['year', new Date('2026-08-09T12:00:00Z').getTime() - 365 * 86_400_000],
    ['all', null],
  ])('maps %s to the expected created-after boundary', (dateRange, expected) => {
    mocks.useSearchURL.mockReturnValue(urlState({ dateRange }));
    const { result } = renderHook(() => useSearchPage());
    expect(result.current.searchContext.createdAfter).toBe(expected);
  });

  it('scopes totals to the current context and exposes a permalink', () => {
    mocks.useSearch.mockReturnValue({ result: 'document-1' });
    mocks.useSearchURL.mockReturnValue(
      urlState({ contentTypes: [ALL_CONTENT_TYPES[0]], view: 'spatial' })
    );
    const { result } = renderHook(() => useSearchPage());
    expect(result.current.permalinkId).toBe('document-1');
    expect(result.current.searchContext.types).toEqual([ALL_CONTENT_TYPES[0]]);
    expect(result.current.totalResults).toBeNull();
    act(() => result.current.setTotalResults(12));
    expect(result.current.totalResults).toBe(12);
    act(() => result.current.setTotalResults(null));
    expect(result.current.totalResults).toBeNull();
  });
});
