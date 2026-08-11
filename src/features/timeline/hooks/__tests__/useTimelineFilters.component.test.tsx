/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_CONTENT_TYPES, useTimelineFilters } from '../useTimelineFilters';

describe('useTimelineFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 15, 30));
  });

  afterEach(() => vi.useRealTimers());

  it('manages every filter setter, toggle direction, count, and reset', () => {
    const { result } = renderHook(() => useTimelineFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.isContentTypeSelected('event')).toBe(true);

    act(() => result.current.toggleContentType('event'));
    expect(result.current.isContentTypeSelected('event')).toBe(false);
    act(() => result.current.toggleContentType('event'));
    expect(result.current.isContentTypeSelected('event')).toBe(true);

    act(() => {
      result.current.setContentTypes(['event']);
      result.current.setDateRange('week');
      result.current.setTopics(['civic']);
      result.current.setEngagement('popular');
      result.current.setSortBy('trending');
      result.current.setSearchQuery('budget');
    });
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.activeFilterCount).toBe(5);
    expect(result.current.filters.sortBy).toBe('trending');

    act(() => result.current.toggleTopic('civic'));
    expect(result.current.filters.topics).toEqual([]);
    act(() => result.current.toggleTopic('new'));
    expect(result.current.filters.topics).toEqual(['new']);

    act(() => result.current.resetContentTypes());
    expect(result.current.filters.contentTypes).toEqual(ALL_CONTENT_TYPES);
    act(() => result.current.resetFilters());
    expect(result.current).toMatchObject({ hasActiveFilters: false, activeFilterCount: 0 });
  });

  it.each([
    ['today', new Date(2026, 7, 9).getTime()],
    ['week', new Date(2026, 7, 2, 15, 30).getTime()],
    ['month', new Date(2026, 6, 10, 15, 30).getTime()],
    ['year', new Date(2025, 7, 9, 15, 30).getTime()],
  ] as const)('computes the %s cutoff', (dateRange, expected) => {
    const { result } = renderHook(() => useTimelineFilters({ dateRange }));
    expect(result.current.getDateCutoff()?.getTime()).toBe(expected);
  });

  it('returns no cutoff for all and unexpected range values', () => {
    const hook = renderHook(() => useTimelineFilters({ dateRange: 'all' }));
    expect(hook.result.current.getDateCutoff()).toBeNull();
    act(() => hook.result.current.setDateRange('unexpected' as any));
    expect(hook.result.current.getDateCutoff()).toBeNull();
  });
});
