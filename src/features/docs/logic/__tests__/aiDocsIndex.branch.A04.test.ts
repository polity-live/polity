import { describe, expect, it } from 'vitest';

import { readPolityDocs } from '../aiDocsIndex';

describe('AI docs index remaining branches', () => {
  it('handles a missing requested page and the default listing path', () => {
    const missing = readPolityDocs({ page: 'not-a-page', section: 'missing' });
    expect(missing).toMatchObject({ page: null, total: 0, pages: [] });

    const listing = readPolityDocs({ language: 'en', limit: 2.9 });
    expect(listing.language).toBe('en');
    expect(listing.pages).toHaveLength(2);
    expect(listing.query).toBeNull();
    expect(listing.pages.every(page => page.sections.length === 0)).toBe(true);
  });

  it('uses the fallback limit for a non-finite value', () => {
    expect(readPolityDocs({ limit: Number.NaN }).pages).toHaveLength(8);
  });
});
