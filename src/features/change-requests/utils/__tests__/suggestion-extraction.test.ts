import { describe, expect, it } from 'vitest';
import {
  countChangedCharacters,
  countChangedCharactersForSuggestion,
  extractSuggestionContent,
} from '../suggestion-extraction';

describe('suggestion extraction changed character counts', () => {
  it('counts inserted and removed suggestion text for one discussion', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'added',
            suggestion: true,
            suggestion_discussion_1: {
              id: 'discussion-1',
              type: 'insert',
            },
          },
          {
            text: 'removed',
            suggestion: true,
            suggestion_discussion_2: {
              id: 'discussion-2',
              type: 'remove',
            },
          },
        ],
      },
    ];

    expect(countChangedCharactersForSuggestion('discussion-1', content)).toBe(5);
    expect(countChangedCharactersForSuggestion('discussion-2', content)).toBe(7);
  });

  it('includes property updates in the changed character count', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'Title',
            suggestion: true,
            suggestion_discussion_1: {
              id: 'discussion-1',
              type: 'update',
              properties: { align: 'left' },
              newProperties: { align: 'center' },
            },
          },
        ],
      },
    ]);

    expect(suggestion.newText).toBe('Title');
    expect(countChangedCharacters(suggestion)).toBe(25);
  });
});
