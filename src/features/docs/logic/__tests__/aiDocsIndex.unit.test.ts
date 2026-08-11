import { describe, expect, it } from 'vitest';

import { DOCS_PAGE_SLUGS, getDocsPages } from '../docsRegistry';
import { readPolityDocs } from '../aiDocsIndex';

describe('Polity docs reader', () => {
  it('returns a complete exact page with table of contents and routes', () => {
    const result = readPolityDocs({
      language: 'de',
      page: 'auth-and-onboarding',
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.slug).toBe('auth-and-onboarding');
    expect(result.pages[0]?.route).toBe('/docs/guides/auth-and-onboarding');
    expect(result.pages[0]?.sections.length).toBeGreaterThanOrEqual(7);
    expect(result.pages[0]?.toc[0]?.route).toContain('#overview');
  });

  it('returns one exact section when requested', () => {
    const result = readPolityDocs({
      language: 'en',
      page: 'navigation-and-page-structure',
      section: 'entity-kontexte',
    });

    expect(result.pages[0]?.sections).toHaveLength(1);
    expect(result.pages[0]?.sections[0]?.plainText).toContain('Secondary items');
  });

  it('searches full German section content', () => {
    const result = readPolityDocs({
      language: 'de',
      query: 'Mitgliedschaften',
      limit: 10,
    });

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.some(match => match.route.includes('#'))).toBe(true);
    expect(result.matches.some(match => match.markdown.includes('Mitgliedschaften'))).toBe(true);
  });

  it('searches full English section content', () => {
    const result = readPolityDocs({
      language: 'en',
      query: 'ballot',
      limit: 10,
    });

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.some(match => match.markdown.toLowerCase().includes('ballot'))).toBe(
      true
    );
  });

  it('can list every page slug available to the agent', () => {
    const pages = getDocsPages('de');
    expect(DOCS_PAGE_SLUGS).toHaveLength(pages.length);

    for (const slug of DOCS_PAGE_SLUGS) {
      const result = readPolityDocs({ language: 'de', page: slug });
      expect(result.pages[0]?.slug).toBe(slug);
      expect(result.pages[0]?.sections.length).toBeGreaterThan(0);
    }
  });

  it('returns no content for missing sections', () => {
    const result = readPolityDocs({
      language: 'de',
      page: 'groups',
      section: 'does-not-exist',
    });
    expect(result.total).toBe(0);
    expect(result.pages).toEqual([]);
  });
});
