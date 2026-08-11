import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchContentItem } from '../../types/search.types';
import {
  buildAgendaItemsByEventId,
  collectAvailableTopics,
  filterAndSortContentItems,
  getCreatedAt,
  getDateCutoff,
  getEngagementScore,
  hasActiveFilters,
} from '../searchFiltering';

const now = new Date(2026, 7, 1, 12);
const item = (
  id: string,
  type: string,
  createdAt: Date | string,
  options: Partial<SearchContentItem> = {}
): SearchContentItem => ({ id, type, title: id, createdAt, ...options }) as SearchContentItem;

const baseOptions = {
  contentTypes: ['blog', 'group'] as never,
  dateRange: 'all' as const,
  topics: [] as string[],
  engagement: 'all' as const,
  sortBy: 'recent' as const,
};

describe('searchFiltering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => vi.useRealTimers());

  it('calculates every date cutoff relative to the current time', () => {
    expect(getDateCutoff('today')).toEqual(new Date(2026, 7, 1));
    expect(getDateCutoff('week')).toEqual(new Date(now.getTime() - 7 * 86_400_000));
    expect(getDateCutoff('month')).toEqual(new Date(now.getTime() - 30 * 86_400_000));
    expect(getDateCutoff('year')).toEqual(new Date(now.getTime() - 365 * 86_400_000));
    expect(getDateCutoff('all')).toBeNull();
    expect(getDateCutoff('unknown' as never)).toBeNull();
  });

  it('normalizes created dates and sums every engagement dimension', () => {
    const date = new Date(1);
    expect(getCreatedAt(item('date', 'blog', date))).toBe(date);
    expect(getCreatedAt(item('string', 'blog', '2026-08-01T10:00:00.000Z'))).toEqual(
      new Date('2026-08-01T10:00:00.000Z')
    );
    expect(getEngagementScore(item('empty', 'blog', date))).toBe(0);
    expect(
      getEngagementScore(
        item('active', 'blog', date, {
          stats: { reactions: 1, comments: 2, views: 3, members: 4 },
        })
      )
    ).toBe(10);
  });

  it('returns no content when all content types are disabled', () => {
    expect(
      filterAndSortContentItems([item('blog', 'blog', now)], { ...baseOptions, contentTypes: [] })
    ).toEqual([]);
  });

  it('filters by type, date and topics before sorting recent items', () => {
    const recent = item('recent', 'blog', new Date(now.getTime() - 1_000), { tags: ['climate'] });
    const older = item('older', 'blog', new Date(now.getTime() - 2_000), { tags: ['climate'] });
    const wrongTopic = item('wrong-topic', 'blog', now, { tags: ['mobility'] });
    const noTags = item('no-tags', 'blog', now);
    const wrongType = item('group', 'group', now, { tags: ['climate'] });
    const yesterday = item('yesterday', 'blog', new Date(2026, 6, 31, 23), { tags: ['climate'] });

    expect(
      filterAndSortContentItems([older, wrongTopic, noTags, wrongType, yesterday, recent], {
        ...baseOptions,
        contentTypes: ['blog'] as never,
        dateRange: 'today',
        topics: ['climate'],
      }).map(entry => entry.id)
    ).toEqual(['recent', 'older']);
  });

  it('supports popular, rising, discussed and defensive engagement filters', () => {
    const recent = item('recent', 'blog', now, { stats: { reactions: 1, comments: 1 } });
    const old = item('old', 'blog', new Date(now.getTime() - 8 * 86_400_000), {
      stats: { reactions: 1, comments: 0 },
    });
    const quiet = item('quiet', 'blog', now, { stats: { reactions: 0, comments: 0 } });
    const noStats = item('no-stats', 'blog', now);
    const entries = [old, quiet, noStats, recent];

    expect(
      filterAndSortContentItems(entries, { ...baseOptions, engagement: 'popular' }).map(
        entry => entry.id
      )
    ).toEqual(['recent', 'old']);
    expect(
      filterAndSortContentItems(entries, { ...baseOptions, engagement: 'rising' }).map(
        entry => entry.id
      )
    ).toEqual(['recent']);
    expect(
      filterAndSortContentItems(entries, { ...baseOptions, engagement: 'discussed' }).map(
        entry => entry.id
      )
    ).toEqual(['recent']);
    expect(
      filterAndSortContentItems(entries, { ...baseOptions, engagement: 'unknown' as never })
    ).toHaveLength(4);
  });

  it('sorts by engagement and by age-weighted trending score', () => {
    const low = item('low', 'blog', new Date(now.getTime() - 60 * 60_000), {
      stats: { reactions: 1 },
    });
    const high = item('high', 'blog', new Date(now.getTime() - 10 * 60_000), {
      stats: { reactions: 5 },
    });
    const future = item('future', 'blog', new Date(now.getTime() + 1_000), {
      stats: { reactions: 2 },
    });

    expect(
      filterAndSortContentItems([low, high], { ...baseOptions, sortBy: 'engagement' }).map(
        entry => entry.id
      )
    ).toEqual(['high', 'low']);
    expect(
      filterAndSortContentItems([low, high, future], { ...baseOptions, sortBy: 'trending' }).map(
        entry => entry.id
      )
    ).toEqual(['future', 'high', 'low']);
    expect(
      filterAndSortContentItems([low, high], { ...baseOptions, sortBy: 'unknown' as never }).map(
        entry => entry.id
      )
    ).toEqual(['high', 'low']);
  });

  it('collects unique topics in insertion order and limits the result', () => {
    const topics = Array.from({ length: 22 }, (_, index) => `topic-${index}`);
    expect(
      collectAvailableTopics([
        item('none', 'blog', now),
        item('topics', 'blog', now, { tags: [...topics, 'topic-0'] }),
      ])
    ).toEqual(topics.slice(0, 20));
  });

  it('groups agenda items by relation id or scalar event id', () => {
    const relation = { event: { id: 'event-1' }, election: { id: 'election-1' } };
    const scalar = { event_id: 'event-1', amendment: { id: 'amendment-1' } };
    const other = { event_id: 'event-2' };
    const missing = { event: null, event_id: null };

    expect(buildAgendaItemsByEventId([relation, scalar, other, missing])).toEqual(
      new Map([
        ['event-1', [relation, scalar]],
        ['event-2', [other]],
      ])
    );
    expect(buildAgendaItemsByEventId([])).toEqual(new Map());
    expect(buildAgendaItemsByEventId(null as never)).toEqual(new Map());
  });

  it('reports every independently active filter and the all-default state', () => {
    const args = [
      ['blog'] as never,
      1,
      'all' as const,
      [] as string[],
      'all' as const,
      '',
    ] as const;
    expect(hasActiveFilters(...args)).toBe(false);
    expect(hasActiveFilters([] as never, 1, 'all', [], 'all', '')).toBe(true);
    expect(hasActiveFilters(['blog'] as never, 1, 'today', [], 'all', '')).toBe(true);
    expect(hasActiveFilters(['blog'] as never, 1, 'all', ['topic'], 'all', '')).toBe(true);
    expect(hasActiveFilters(['blog'] as never, 1, 'all', [], 'popular', '')).toBe(true);
    expect(hasActiveFilters(['blog'] as never, 1, 'all', [], 'all', 'query')).toBe(true);
  });
});
