import { describe, expect, it } from 'vitest';

import {
  getDocsNavigation,
  getDocsPage,
  getRelatedDocsPages,
  getLegacyTopicCanonicalRoute,
  isDocsPageSlug,
} from '../docsRegistry';

describe('docs registry remaining branches', () => {
  it('distinguishes missing pages, kinds, and slugs', () => {
    expect(getDocsPage('groups', 'de')).not.toBeNull();
    expect(getDocsPage('groups', 'de', 'getting-started')).toBeNull();
    expect(getDocsPage('not-a-page', 'de')).toBeNull();
    expect(isDocsPageSlug('groups')).toBe(true);
    expect(isDocsPageSlug('not-a-page')).toBe(false);
  });

  it('builds English navigation and canonical legacy routes', () => {
    const navigation = getDocsNavigation('en');

    expect(navigation[0]).toMatchObject({
      id: 'getting-started',
      title: 'Getting started',
      description: 'Arrive in Polity step by step.',
    });
    expect(getLegacyTopicCanonicalRoute('groups')).toBe('/docs/guides/groups');
    expect(getLegacyTopicCanonicalRoute('not-a-page')).toBeNull();
    const groups = getDocsPage('groups', 'en', 'guide');
    expect(groups).not.toBeNull();
    expect(getRelatedDocsPages(groups!, 'en').length).toBeGreaterThan(0);
  });
});
