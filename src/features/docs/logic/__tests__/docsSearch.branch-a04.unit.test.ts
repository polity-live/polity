import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pages: [] as any[] }));

vi.mock('../docsRegistry', () => ({ getDocsPages: () => state.pages }));

import { searchDocs } from '../docsSearch';

function page(slug: string) {
  return {
    audience: 'match',
    category: 'systems',
    description: 'match',
    featured: false,
    icon: 'BookOpen',
    keywords: [],
    kind: 'guide',
    order: 0,
    related: [],
    route: `/docs/${slug}`,
    sections: [],
    slug,
    title: 'match',
  };
}

beforeEach(() => {
  state.pages = [page('one'), page('two')];
});

describe('docs search remaining branches', () => {
  it('returns early for an empty normalized query', () => {
    expect(searchDocs({ query: '***' })).toEqual([]);
  });

  it('uses page-level title fallbacks when tied results reach the final comparator', () => {
    const results = searchDocs({ query: 'match', limit: 50 });
    expect(results).toHaveLength(2);
    expect(results.every(result => result.section === null)).toBe(true);
  });
});
