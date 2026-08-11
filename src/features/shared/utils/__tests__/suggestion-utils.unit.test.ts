import { describe, expect, it } from 'vitest';

import {
  formatSuggestionId,
  getCurrentSuggestionCounter,
  getNextSuggestionIdFromDiscussions,
  isValidSuggestionId,
  parseSuggestionId,
} from '../suggestion-utils';

describe('suggestion id helpers', () => {
  it('parses, formats, and validates exact CR identifiers', () => {
    expect(parseSuggestionId('CR-42')).toBe(42);
    expect(parseSuggestionId('cr-42')).toBeNull();
    expect(formatSuggestionId(7)).toBe('CR-7');
    expect(isValidSuggestionId('CR-7')).toBe(true);
    expect(isValidSuggestionId('CR-seven')).toBe(false);
  });

  it('finds the maximum valid counter while ignoring absent, invalid, and lower ids', () => {
    const discussions = [
      {},
      { crId: 'invalid' },
      { crId: 'CR-2' },
      { crId: 'CR-1' },
      { crId: 'CR-9' },
    ];

    expect(getCurrentSuggestionCounter(discussions)).toBe(9);
    expect(getNextSuggestionIdFromDiscussions(discussions)).toBe('CR-10');
  });

  it('starts at one for an empty collection', () => {
    expect(getCurrentSuggestionCounter([])).toBe(0);
    expect(getNextSuggestionIdFromDiscussions([])).toBe('CR-1');
  });
});
