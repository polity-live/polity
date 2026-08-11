import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CONTENT_TYPES } from '@/features/timeline/hooks/useTimelineFilters';

import { createSearchDocumentPageArgs, SEARCH_INITIAL_PAGE_LIMIT } from '../search-context';

describe('search preload argument normalization', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-08-09T12:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('normalizes empty and populated filters, topics, types, engagement, and sort', () => {
    expect(createSearchDocumentPageArgs({})).toMatchObject({
      query: '',
      types: [],
      topics: [],
      createdAfter: null,
      engagement: 'all',
      sort: 'recent',
      limit: SEARCH_INITIAL_PAGE_LIMIT,
    });
    expect(
      createSearchDocumentPageArgs({
        q: 'budget',
        types: 'event, invalid ',
        topics: ' climate, ,mobility ',
        hashtag: 'climate',
        engagement: 'popular',
        sort: 'trending',
      })
    ).toMatchObject({
      query: 'budget',
      types: ['event'],
      topics: ['climate', 'mobility'],
      engagement: 'popular',
      sort: 'trending',
    });
    expect(
      createSearchDocumentPageArgs({
        types: ALL_CONTENT_TYPES.join(','),
        hashtag: 'new',
        engagement: 'rising',
        sort: 'engagement',
      })
    ).toMatchObject({ types: [], topics: ['new'], engagement: 'rising', sort: 'engagement' });
    expect(createSearchDocumentPageArgs({ engagement: 'discussed' })).toMatchObject({
      engagement: 'discussed',
    });
  });

  it('computes each supported relative date boundary', () => {
    const today = createSearchDocumentPageArgs({ range: 'today' }).createdAfter;
    const week = createSearchDocumentPageArgs({ range: 'week' }).createdAfter;
    const month = createSearchDocumentPageArgs({ range: 'month' }).createdAfter;
    const year = createSearchDocumentPageArgs({ range: 'year' }).createdAfter;
    expect(today).toBe(new Date(2026, 7, 9).getTime());
    expect(week).toBe(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(month).toBe(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(year).toBe(Date.now() - 365 * 24 * 60 * 60 * 1000);
  });
});
