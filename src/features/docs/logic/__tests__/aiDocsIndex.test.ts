import { describe, expect, it } from 'vitest';

import { getPolityDocsTopics, searchPolityDocs } from '../aiDocsIndex';

describe('aiDocsIndex', () => {
  it('returns a specific topic by slug', () => {
    const result = searchPolityDocs({
      language: 'de',
      topic: 'auth-and-onboarding',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe('auth-and-onboarding');
    expect(result.items[0]?.route).toBe('/docs/auth-and-onboarding');
    expect(result.items[0]?.title).toContain('Anmeldung');
  });

  it('searches across German docs text', () => {
    const result = searchPolityDocs({
      language: 'de',
      query: 'Mitgliedschaften',
      limit: 5,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.some(item => item.searchText.includes('Mitgliedschaften'))).toBe(true);
  });

  it('searches across English docs text', () => {
    const result = searchPolityDocs({
      language: 'en',
      query: 'ballot',
      limit: 5,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.some(item => item.searchText.toLowerCase().includes('ballot'))).toBe(true);
  });

  it('includes related topic and process route metadata', () => {
    const result = searchPolityDocs({
      language: 'en',
      topic: 'groups',
    });
    const topic = result.items[0];

    expect(topic?.route).toBe('/docs/groups');
    expect(topic?.relatedTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'users', route: '/docs/users' }),
        expect.objectContaining({ slug: 'events', route: '/docs/events' }),
      ])
    );
    expect(topic?.process.steps.length).toBeGreaterThan(0);
    expect(topic?.process.steps[0]).toEqual(
      expect.objectContaining({
        id: 'create-space',
        title: 'Create the space',
      })
    );
  });

  it('clamps empty and no-match results safely', () => {
    const allTopics = getPolityDocsTopics('de');
    const cappedResult = searchPolityDocs({ language: 'de', limit: 999 });
    const noMatchResult = searchPolityDocs({
      language: 'de',
      query: 'zzzz-no-polity-doc-topic',
      limit: 999,
    });

    expect(cappedResult.items).toHaveLength(Math.min(12, allTopics.length));
    expect(noMatchResult.total).toBe(0);
    expect(noMatchResult.items).toEqual([]);
  });
});
