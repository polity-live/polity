import { describe, expect, it } from 'vitest';

import {
  completeInterestSuggestions,
  rankInterestSuggestions,
  type HashtagUsageRow,
} from '../interestSuggestions';

function usage(tag: string, overrides: Omit<HashtagUsageRow, 'tag'> = {}): HashtagUsageRow {
  return { tag, ...overrides };
}

describe('rankInterestSuggestions', () => {
  it('counts every supported hashtag junction and ranks by total usage', () => {
    const suggestions = rankInterestSuggestions([
      usage('climate', {
        user_hashtags: [{}],
        group_hashtags: [{}],
        amendment_hashtags: [{}],
        event_hashtags: [{}],
        blog_hashtags: [{}],
        statement_hashtags: [{}],
      }),
      usage('housing', { user_hashtags: [{}, {}, {}, {}, {}, {}, {}] }),
      usage('mobility', { group_hashtags: [{}] }),
    ]);

    expect(suggestions).toEqual(['housing', 'climate', 'mobility']);
  });

  it('orders equal counts case-insensitively and returns at most ten tags', () => {
    const suggestions = rankInterestSuggestions([
      usage('Zebra'),
      usage('äpfel'),
      usage('apple'),
      ...Array.from({ length: 10 }, (_, index) =>
        usage(`topic-${index}`, { event_hashtags: [{}] })
      ),
    ]);

    expect(suggestions).toHaveLength(10);
    expect(suggestions.slice(0, 10)).toEqual([
      'topic-0',
      'topic-1',
      'topic-2',
      'topic-3',
      'topic-4',
      'topic-5',
      'topic-6',
      'topic-7',
      'topic-8',
      'topic-9',
    ]);
  });

  it('merges canonical tag variants before ranking them', () => {
    const suggestions = rankInterestSuggestions([
      usage('Climate', { group_hashtags: [{}] }),
      usage('climate', { event_hashtags: [{}, {}] }),
      usage('housing', { user_hashtags: [{}] }),
    ]);

    expect(suggestions).toEqual(['Climate', 'housing']);
  });
});

describe('completeInterestSuggestions', () => {
  it('keeps database suggestions first and fills remaining places with defaults', () => {
    expect(
      completeInterestSuggestions(['climate', 'housing'], ['Climate', 'mobility', 'education'])
    ).toEqual(['climate', 'housing', 'mobility', 'education']);
  });

  it('does not add fallback tags when ten database suggestions already exist', () => {
    const databaseTags = Array.from({ length: 10 }, (_, index) => `topic-${index}`);

    expect(completeInterestSuggestions(databaseTags, ['climate', 'housing'])).toEqual(databaseTags);
  });
});
