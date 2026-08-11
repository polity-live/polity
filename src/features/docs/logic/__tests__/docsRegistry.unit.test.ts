import { describe, expect, it } from 'vitest';

import { getDocsNavigation, getDocsPage, getDocsPages } from '../docsRegistry';
import { searchDocs } from '../docsSearch';

describe('docs registry', () => {
  it('keeps German and English page and section structure in parity', () => {
    const de = getDocsPages('de');
    const en = getDocsPages('en');
    expect(en.map(page => page.slug)).toEqual(de.map(page => page.slug));

    de.forEach((page, index) => {
      expect(en[index]?.sections.map(section => section.id)).toEqual(
        page.sections.map(section => section.id)
      );
    });
  });

  it('uses unique slugs and section ids with valid related pages', () => {
    const pages = getDocsPages('de');
    const slugs = pages.map(page => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const page of pages) {
      const sectionIds = page.sections.map(section => section.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      page.related.forEach(slug => expect(slugs).toContain(slug));
    }
  });

  it('builds navigation whose targets all resolve', () => {
    const pages = getDocsPages('de');
    const navigationPages = getDocsNavigation('de').flatMap(group => group.pages);
    expect(navigationPages.map(page => page.route).sort()).toEqual(
      pages.map(page => page.route).sort()
    );
  });

  it('weights titles and headings above body-only results', () => {
    const matches = searchDocs({ language: 'de', query: 'Navigation', limit: 20 });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.page.slug).toMatch(/navigation/);
  });

  it('normalizes umlauts and requires every query term', () => {
    const umlaut = searchDocs({ language: 'de', query: 'Änderungsanträge', limit: 20 });
    const ascii = searchDocs({ language: 'de', query: 'Anderungsantrage', limit: 20 });
    expect(umlaut.length).toBeGreaterThan(0);
    expect(ascii.map(match => match.route)).toEqual(umlaut.map(match => match.route));
    expect(searchDocs({ language: 'de', query: 'Gruppe zzzz-no-match' })).toEqual([]);
  });

  it('publishes the short live tutorial guide and authenticated CTA', () => {
    const page = getDocsPage('app-onboarding', 'de', 'guide');

    expect(page?.featured).toBe(true);
    expect(page?.title).toBe('Interaktives Live-Tutorial');
    expect(page?.sections.map(section => section.id)).toEqual([
      'how-it-works',
      'sandbox',
      'journey',
      'pause-restart-finish',
    ]);
    expect(page?.primaryAction?.route).toBe('/onboarding');
    expect(page?.primaryAction?.requiresAuth).toBe(true);
  });
});
