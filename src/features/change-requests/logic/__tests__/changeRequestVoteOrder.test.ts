import { describe, expect, it } from 'vitest';
import {
  buildSuggestionDocumentOrder,
  sortChangeRequestsByVoteOrder,
} from '../changeRequestVoteOrder';

function createChangeRequest(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    title: id,
    branch_display_number: 2,
    branch_sequence_number: Number.parseInt(id.replace(/\D/g, ''), 10),
    changed_character_count: 10,
    created_at: 1000,
    ...overrides,
  };
}

describe('changeRequestVoteOrder', () => {
  it('sorts by text position before CR label fallback', () => {
    const cr13 = createChangeRequest('CR-13');
    const cr15 = createChangeRequest('CR-15');
    const suggestionDocumentOrder = buildSuggestionDocumentOrder([
      {
        type: 'p',
        children: [{ text: 'early', suggestion_15: { id: 'suggestion-15' } }],
      },
      {
        type: 'p',
        children: [{ text: 'later', suggestion_13: { id: 'suggestion-13' } }],
      },
    ]);

    const ordered = sortChangeRequestsByVoteOrder([cr13, cr15], 'text_position', {
      getSuggestionId: item => (item.id === 'CR-15' ? 'suggestion-15' : 'suggestion-13'),
      suggestionDocumentOrder,
    });

    expect(ordered.map(item => item.id)).toEqual(['CR-15', 'CR-13']);
  });

  it('sorts by changed character count with larger changes first', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        createChangeRequest('CR-11', { changed_character_count: 20 }),
        createChangeRequest('CR-9', { changed_character_count: 3 }),
        createChangeRequest('CR-13', { changed_character_count: 10 }),
      ],
      'changed_character_count'
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-11', 'CR-13', 'CR-9']);
  });

  it('falls back to removed and added text when a persisted character count is zero', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        createChangeRequest('CR-6', {
          changed_character_count: 0,
          original_text: 'BR-1: Soll CR-2 nicht entfernt werden',
          new_text: '',
        }),
        createChangeRequest('CR-4', {
          changed_character_count: 0,
          original_text: '',
          new_text: ' hinzugefügt',
        }),
        createChangeRequest('CR-2', {
          changed_character_count: 0,
          original_text: '',
          new_text: ' nicht hinzugefügt',
        }),
        createChangeRequest('CR-8', {
          changed_character_count: 0,
          original_text: 'Soll CR-1 entfernt werden',
          new_text: '',
        }),
      ],
      'changed_character_count'
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-6', 'CR-8', 'CR-2', 'CR-4']);
  });

  it('sorts by CR number and falls back to created_at', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        createChangeRequest('row-late', {
          title: 'Untitled late',
          branch_sequence_number: null,
          created_at: 3000,
        }),
        createChangeRequest('CR-9', { branch_sequence_number: 9, created_at: 2000 }),
        createChangeRequest('row-early', {
          title: 'Untitled early',
          branch_sequence_number: null,
          created_at: 1000,
        }),
      ],
      'cr_number'
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-9', 'row-early', 'row-late']);
  });
});
