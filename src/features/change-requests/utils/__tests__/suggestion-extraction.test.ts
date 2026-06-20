import { describe, expect, it } from 'vitest';
import {
  countChangedCharacters,
  countChangedCharactersForSuggestion,
  createChangeRequestDiffSnapshot,
  extractSuggestionContent,
  suggestionContentFromChangeRequestSnapshot,
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

  it('infers replace when one suggestion has removed and inserted text', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'old',
            suggestion: true,
            suggestion_old: {
              id: 'discussion-1',
              type: 'remove',
            },
          },
          {
            text: 'new',
            suggestion: true,
            suggestion_new: {
              id: 'discussion-1',
              type: 'insert',
            },
          },
        ],
      },
    ]);

    expect(suggestion).toMatchObject({
      type: 'replace',
      text: 'old',
      newText: 'new',
    });
  });

  it('creates and restores a persisted change request diff snapshot', () => {
    const snapshot = createChangeRequestDiffSnapshot('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'Wird hinzugefügt',
            suggestion: true,
            suggestion_discussion_1: {
              id: 'discussion-1',
              type: 'insert',
            },
          },
        ],
      },
    ]);

    expect(snapshot).toMatchObject({
      change_type: 'insert',
      original_text: null,
      new_text: 'Wird hinzugefügt',
      changed_character_count: 16,
    });
    expect(suggestionContentFromChangeRequestSnapshot(snapshot)).toMatchObject({
      type: 'insert',
      text: '',
      newText: 'Wird hinzugefügt',
    });
  });
});
