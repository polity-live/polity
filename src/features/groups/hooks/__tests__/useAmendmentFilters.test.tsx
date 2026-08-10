/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ group: vi.fn() }));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (relations: any) =>
    (relations ?? []).flatMap((relation: any) =>
      relation.hashtag?.tag ? [relation.hashtag.tag] : []
    ),
}));
vi.mock('@/features/groups/logic/groupAmendmentStatus', () => ({
  groupAmendmentsByDisplayStatus: (items: unknown[]) => {
    mocks.group(items);
    return { grouped: items };
  },
}));

import { useAmendmentFilters, useFilteredAmendments } from '../useAmendmentFilters';

function amendment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: '',
    subtitle: '',
    code: '',
    decision_status: 'draft',
    date: null,
    amendment_hashtags: [],
    ...overrides,
  } as any;
}

const baseFilters = { searchQuery: '', statusFilter: 'all', hashtagFilter: '' };

beforeEach(() => vi.clearAllMocks());

describe('useAmendmentFilters', () => {
  it('updates, clears and toggles every filter state', () => {
    const { result } = renderHook(() => useAmendmentFilters());
    expect(result.current).toMatchObject({
      filters: baseFilters,
      showFilters: false,
      hasActiveFilters: false,
    });

    act(() => result.current.updateFilter('searchQuery', 'budget'));
    act(() => result.current.updateFilter('statusFilter', 'accepted'));
    expect(result.current.filters).toMatchObject({
      searchQuery: 'budget',
      statusFilter: 'accepted',
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => result.current.clearFilter('statusFilter'));
    expect(result.current.filters.statusFilter).toBe('all');
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => result.current.updateFilter('hashtagFilter', '#energy'));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.clearFilter('hashtagFilter'));
    act(() => result.current.clearFilter('searchQuery'));
    expect(result.current.filters).toEqual(baseFilters);

    act(() => result.current.setShowFilters(true));
    expect(result.current.showFilters).toBe(true);
  });
});

describe('useFilteredAmendments search', () => {
  it('matches title, subtitle and code while excluding a non-match without hashtags', () => {
    const rows = [
      amendment('title', { title: 'Needle proposal' }),
      amendment('subtitle', { subtitle: 'A NEEDLE subtitle' }),
      amendment('code', { code: 'NEEDLE-42' }),
      amendment('none', { title: 'Other', subtitle: null, code: null }),
    ];
    const { result } = renderHook(() =>
      useFilteredAmendments(rows, { ...baseFilters, searchQuery: 'needle' })
    );
    expect(result.current.sortedAmendments.map(item => item.id).sort()).toEqual([
      'code',
      'subtitle',
      'title',
    ]);
  });

  it('falls back to hashtag search and covers matching and non-matching tag lists', () => {
    const rows = [
      amendment('tag-match', {
        amendment_hashtags: [{ hashtag: { id: 'tag-1', tag: 'ClimateJustice' } }],
      }),
      amendment('tag-miss', {
        amendment_hashtags: [{ hashtag: { id: 'tag-2', tag: 'Housing' } }],
      }),
      amendment('no-tags'),
    ];
    const { result } = renderHook(() =>
      useFilteredAmendments(rows, { ...baseFilters, searchQuery: 'climate' })
    );
    expect(result.current.sortedAmendments.map(item => item.id)).toEqual(['tag-match']);
  });
});

describe('useFilteredAmendments combined filters and sorting', () => {
  it('applies status and exact or partial hashtag filters', () => {
    const rows = [
      amendment('exact', {
        decision_status: 'accepted',
        amendment_hashtags: [{ hashtag: { id: '1', tag: 'Energy' } }],
      }),
      amendment('partial', {
        decision_status: 'accepted',
        amendment_hashtags: [{ hashtag: { id: '2', tag: 'RenewableEnergy' } }],
      }),
      amendment('wrong-status', {
        decision_status: 'rejected',
        amendment_hashtags: [{ hashtag: { id: '3', tag: 'Energy' } }],
      }),
      amendment('no-tags', { decision_status: 'accepted' }),
      amendment('wrong-tag', {
        decision_status: 'accepted',
        amendment_hashtags: [{ hashtag: { id: '4', tag: 'Housing' } }],
      }),
    ];
    const exact = renderHook(() =>
      useFilteredAmendments(rows, {
        searchQuery: '',
        statusFilter: 'accepted',
        hashtagFilter: '#energy',
      })
    );
    expect(exact.result.current.sortedAmendments.map(item => item.id)).toEqual([
      'exact',
      'partial',
    ]);
    exact.unmount();

    const partial = renderHook(() =>
      useFilteredAmendments(rows, {
        searchQuery: '',
        statusFilter: 'accepted',
        hashtagFilter: 'newable',
      })
    );
    expect(partial.result.current.sortedAmendments.map(item => item.id)).toEqual(['partial']);
  });

  it('sorts newest first with zero-time fallbacks and forwards the sorted list for grouping', () => {
    const rows = [
      amendment('missing', { date: undefined }),
      amendment('old', { date: '2020-01-01T00:00:00Z' }),
      amendment('new', { date: '2026-01-01T00:00:00Z' }),
      amendment('null', { date: null }),
    ];
    const { result } = renderHook(() => useFilteredAmendments(rows, baseFilters));
    expect(result.current.sortedAmendments.map(item => item.id)).toEqual([
      'new',
      'old',
      'missing',
      'null',
    ]);
    expect(mocks.group).toHaveBeenCalledWith(result.current.sortedAmendments);
    expect(result.current.groupedAmendments).toEqual({ grouped: result.current.sortedAmendments });
  });
});
