import { describe, expect, it } from 'vitest';

import {
  normalizeSearchQuery,
  prefixPattern,
  searchPattern,
  searchSortField,
  searchStartRow,
  sortDirection,
  tokenizeSearchQuery,
} from '../search-query-helpers';

describe('search query helpers', () => {
  it('normalizes, tokenizes, and builds wildcard patterns', () => {
    expect(normalizeSearchQuery('  FOO_%*?  bar  ')).toBe('foo bar');
    expect(tokenizeSearchQuery('  FOO   bar ')).toEqual(['foo', 'bar']);
    expect(searchPattern('foo bar')).toBe('%foo%bar%');
    expect(searchPattern(' _ ')).toBe('');
    expect(prefixPattern(' Foo ')).toBe('foo%');
    expect(prefixPattern(' *** ')).toBe('');
  });

  it.each([
    ['recent', 'created_at'],
    ['engagement', 'engagement_score'],
    ['trending', 'trending_score'],
  ] as const)('maps %s to its sort field', (sort, field) => {
    expect(searchSortField(sort)).toBe(field);
  });

  it('maps cursor directions', () => {
    expect(sortDirection('forward')).toBe('desc');
    expect(sortDirection('backward')).toBe('asc');
  });

  it('normalizes search start rows for every sort', () => {
    expect(searchStartRow(null, 'recent')).toBeNull();
    expect(searchStartRow(undefined, 'recent')).toBeNull();
    expect(searchStartRow({ id: '1', created_at: 2 }, 'recent')).toEqual({
      created_at: 2,
      id: '1',
    });
    expect(searchStartRow({ id: '1', created_at: 2 }, 'engagement')).toEqual({
      engagement_score: 0,
      created_at: 2,
      id: '1',
    });
    expect(
      searchStartRow({ id: '1', created_at: 2, engagement_score: 3 }, 'engagement')
    ).toEqual({ engagement_score: 3, created_at: 2, id: '1' });
    expect(searchStartRow({ id: '1', created_at: 2 }, 'trending')).toEqual({
      trending_score: 0,
      created_at: 2,
      id: '1',
    });
    expect(searchStartRow({ id: '1', created_at: 2, trending_score: 4 }, 'trending')).toEqual({
      trending_score: 4,
      created_at: 2,
      id: '1',
    });
  });
});
