import { describe, expect, it, vi } from 'vitest';

import { buildSearchText, matchesSearchQuery, toSearchableText } from '../userWikiSearch';

const richTextToPlainText = vi.hoisted(() =>
  vi.fn((value: unknown) =>
    typeof value === 'string' ? `Plain ${value}` : `Object ${JSON.stringify(value)}`
  )
);

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => richTextToPlainText(value),
}));

describe('userWikiSearch', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    ['HELLO', 'plain hello'],
    [42, '42'],
    [true, 'true'],
    [42n, '42'],
  ])('normalizes scalar value %s', (value, expected) => {
    expect(toSearchableText(value)).toBe(expected);
  });

  it('normalizes dates, nested arrays and object-shaped rich text', () => {
    expect(toSearchableText(new Date('2026-08-01T10:00:00.000Z'))).toBe('2026-08-01t10:00:00.000z');
    expect(toSearchableText(['A', null, [2, false]])).toBe('plain a 2 false');
    expect(toSearchableText({ type: 'doc' })).toBe('object {"type":"doc"}');
  });

  it('joins only non-empty searchable values', () => {
    expect(buildSearchText('Alpha', null, 7, [])).toBe('plain alpha 7');
  });

  it('treats an empty query as a match and otherwise searches any supplied value', () => {
    expect(matchesSearchQuery('   ', null)).toBe(true);
    expect(matchesSearchQuery('PHA', 'Alpha', 'Beta')).toBe(true);
    expect(matchesSearchQuery('7', 'Alpha', 7)).toBe(true);
    expect(matchesSearchQuery('missing', 'Alpha', 7)).toBe(false);
  });
});
