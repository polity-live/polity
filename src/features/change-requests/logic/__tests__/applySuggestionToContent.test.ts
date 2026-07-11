import { describe, expect, it } from 'vitest';
import type { Value } from 'platejs';

import {
  applyResolvedSuggestionsToContent,
  applySuggestionToContent,
} from '../applySuggestionToContent';

function textContent(content: Value) {
  return JSON.stringify(content);
}

describe('applySuggestionToContent', () => {
  it('accepts removals by removing text and rejects removals by keeping text', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Wird entfernt',
            suggestion: true,
            suggestion_remove: { id: 'suggestion-1', type: 'remove' },
          },
        ],
      },
    ] as Value;

    expect(textContent(applySuggestionToContent(content, 'suggestion-1', 'accept'))).not.toContain(
      'Wird entfernt'
    );
    expect(textContent(applySuggestionToContent(content, 'suggestion-1', 'reject'))).toContain(
      'Wird entfernt'
    );
  });

  it('accepts insertions by keeping text and rejects insertions by removing text', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Wird hinzugefügt',
            suggestion: true,
            suggestion_insert: { id: 'suggestion-1', type: 'insert' },
          },
        ],
      },
    ] as Value;

    expect(textContent(applySuggestionToContent(content, 'suggestion-1', 'accept'))).toContain(
      'Wird hinzugefügt'
    );
    expect(textContent(applySuggestionToContent(content, 'suggestion-1', 'reject'))).not.toContain(
      'Wird hinzugefügt'
    );
  });

  it('reapplies completed decisions to stale document content', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Nicht hinzufügen',
            suggestion: true,
            suggestion_insert: { id: 'suggestion-insert', type: 'insert' },
          },
          {
            text: 'Nicht entfernen',
            suggestion: true,
            suggestion_remove: { id: 'suggestion-remove', type: 'remove' },
          },
        ],
      },
    ] as Value;

    const resolved = applyResolvedSuggestionsToContent(content, [
      {
        suggestion_id: 'suggestion-insert',
        status: 'rejected',
        voting_status: 'completed',
        created_at: 1,
      },
      {
        suggestion_id: 'suggestion-remove',
        status: 'rejected',
        voting_status: 'completed',
        created_at: 2,
      },
    ]);

    expect(textContent(resolved)).not.toContain('Nicht hinzufügen');
    expect(textContent(resolved)).toContain('Nicht entfernen');
    expect(textContent(resolved)).not.toContain('suggestion-remove');
  });
});
