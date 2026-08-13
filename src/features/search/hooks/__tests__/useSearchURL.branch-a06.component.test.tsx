/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_CONTENT_TYPES } from '@/features/timeline/hooks/useTimelineFilters';
import { useSearchURL } from '../useSearchURL';

const navigateMock = vi.fn();
let searchParams: Record<string, string> = {};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchParams,
}));

describe('useSearchURL branch matrix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockReset();
    searchParams = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses valid filters, trims lists, injects a missing hashtag and preserves unrelated params', () => {
    searchParams = {
      q: 'assembly',
      types: ` ${ALL_CONTENT_TYPES[0]},,invalid,${ALL_CONTENT_TYPES[1]} `,
      range: 'today',
      topics: ' democracy, ,local ',
      hashtag: 'federal',
      engagement: 'popular',
      sort: 'trending',
      view: 'spatial',
      keep: 'yes',
      nullable: null as unknown as string,
    };
    const { result } = renderHook(() => useSearchURL());

    expect(result.current.searchQuery).toBe('assembly');
    expect(result.current.contentTypes).toEqual([ALL_CONTENT_TYPES[0], ALL_CONTENT_TYPES[1]]);
    expect(result.current.dateRange).toBe('today');
    expect(result.current.topics).toEqual(['democracy', 'local', 'federal']);
    expect(result.current.engagement).toBe('popular');
    expect(result.current.sortBy).toBe('trending');
    expect(result.current.view).toBe('spatial');

    act(() => vi.advanceTimersByTime(250));
    const destination = navigateMock.mock.lastCall?.[0].to as string;
    expect(destination).toContain('keep=yes');
    expect(destination).not.toContain('nullable');
    expect(destination).toContain('types=');
    expect(destination).toContain('range=today');
    expect(destination).toContain('engagement=popular');
    expect(destination).toContain('sort=trending');
    expect(destination).toContain('view=spatial');
  });

  it.each(['week', 'month', 'year'] as const)('accepts the %s date range', range => {
    searchParams = { range };
    const { result } = renderHook(() => useSearchURL());
    expect(result.current.dateRange).toBe(range);
  });

  it.each(['rising', 'discussed'] as const)('accepts the %s engagement filter', engagement => {
    searchParams = { engagement };
    const { result } = renderHook(() => useSearchURL());
    expect(result.current.engagement).toBe(engagement);
  });

  it('falls back for invalid type and enum parameters and avoids a duplicate hashtag', () => {
    searchParams = {
      types: 'invalid, also-invalid',
      range: 'invalid',
      topics: 'same',
      hashtag: 'same',
      engagement: 'invalid',
      sort: 'invalid',
      view: 'invalid',
    };
    const { result } = renderHook(() => useSearchURL());

    expect(result.current.contentTypes).toEqual(ALL_CONTENT_TYPES);
    expect(result.current.dateRange).toBe('all');
    expect(result.current.topics).toEqual(['same']);
    expect(result.current.engagement).toBe('all');
    expect(result.current.sortBy).toBe('recent');
    expect(result.current.view).toBe('list');
  });

  it('serializes non-default state and deletes default state from the URL', () => {
    searchParams = {
      q: 'old',
      types: ALL_CONTENT_TYPES[0],
      range: 'week',
      topics: 'old',
      engagement: 'rising',
      sort: 'engagement',
      view: 'spatial',
    };
    const { result } = renderHook(() => useSearchURL());

    expect(result.current.sortBy).toBe('engagement');
    act(() => {
      result.current.setSearchQuery('');
      result.current.setContentTypes([...ALL_CONTENT_TYPES]);
      result.current.setDateRange('all');
      result.current.setTopics([]);
      result.current.setEngagement('all');
      result.current.setSortBy('recent');
      result.current.setView('list');
    });
    act(() => vi.advanceTimersByTime(250));
    expect(navigateMock).toHaveBeenLastCalledWith({ to: '/search?' });

    act(() => {
      result.current.setSearchQuery('new');
      result.current.setContentTypes([ALL_CONTENT_TYPES[0]]);
      result.current.setDateRange('month');
      result.current.setTopics(['topic']);
      result.current.setEngagement('discussed');
      result.current.setSortBy('trending');
      result.current.setView('spatial');
    });
    act(() => vi.advanceTimersByTime(250));

    const destination = navigateMock.mock.lastCall?.[0].to as string;
    expect(destination).toContain('q=new');
    expect(destination).toContain(`types=${ALL_CONTENT_TYPES[0]}`);
    expect(destination).toContain('range=month');
    expect(destination).toContain('topics=topic');
    expect(destination).toContain('engagement=discussed');
    expect(destination).toContain('sort=trending');
    expect(destination).toContain('view=spatial');
  });

  it('cancels a pending URL update when unmounted', () => {
    const { unmount } = renderHook(() => useSearchURL());
    unmount();
    act(() => vi.advanceTimersByTime(250));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
