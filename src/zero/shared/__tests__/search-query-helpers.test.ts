import { describe, expect, it } from 'vitest';
import {
  normalizeSearchQuery,
  prefixPattern,
  searchPattern,
  searchStartRow,
  sortDirection,
} from '../search-query-helpers';

describe('search query helpers', () => {
  it('normalizes whitespace and strips wildcard characters', () => {
    expect(normalizeSearchQuery('  Pol%_ity   Vote?*  ')).toBe('pol ity vote');
  });

  it('builds token-ordered substring patterns', () => {
    expect(searchPattern('climate amendment')).toBe('%climate%amendment%');
  });

  it('builds short-query prefix patterns', () => {
    expect(prefixPattern(' A* ')).toBe('a%');
  });

  it('inverts sort direction for backward pages', () => {
    expect(sortDirection('forward')).toBe('desc');
    expect(sortDirection('backward')).toBe('asc');
  });

  it('keeps cursor rows aligned with the selected sort', () => {
    const start = {
      id: 'doc-1',
      created_at: 100,
      engagement_score: 7,
      trending_score: 3,
    };

    expect(searchStartRow(start, 'recent')).toEqual({ created_at: 100, id: 'doc-1' });
    expect(searchStartRow(start, 'engagement')).toEqual({
      engagement_score: 7,
      created_at: 100,
      id: 'doc-1',
    });
    expect(searchStartRow(start, 'trending')).toEqual({
      trending_score: 3,
      created_at: 100,
      id: 'doc-1',
    });
  });
});
