import { describe, expect, it } from 'vitest';
import type { Value } from 'platejs';

import { discardPendingEventSuggestionsFromState } from '../event-suggestions';

function textContent(content: Value | null) {
  return JSON.stringify(content);
}

describe('discardPendingEventSuggestionsFromState', () => {
  it('removes pending event insertions and their discussion entries', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Noch nicht eingereicht',
            suggestion: true,
            suggestion_insert: { id: 'discussion-pending', type: 'insert' },
          },
        ],
      },
    ] as Value;

    const result = discardPendingEventSuggestionsFromState({
      content,
      discussions: [
        {
          id: 'discussion-pending',
          confirmationStatus: 'pending',
        },
      ],
    });

    expect(result.removedCount).toBe(1);
    expect(result.discussions).toHaveLength(0);
    expect(textContent(result.content)).not.toContain('Noch nicht eingereicht');
  });

  it('rejects pending removals by keeping the original text without the suggestion mark', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Soll bleiben',
            suggestion: true,
            suggestion_remove: { id: 'discussion-pending', type: 'remove' },
          },
        ],
      },
    ] as Value;

    const result = discardPendingEventSuggestionsFromState({
      content,
      discussions: [
        {
          id: 'discussion-pending',
          confirmationStatus: 'pending',
        },
      ],
    });

    expect(result.removedCount).toBe(1);
    expect(textContent(result.content)).toContain('Soll bleiben');
    expect(textContent(result.content)).not.toContain('suggestion_remove');
  });

  it('keeps confirmed and persisted change requests', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Eingereicht',
            suggestion: true,
            suggestion_insert: { id: 'discussion-confirmed', type: 'insert' },
          },
        ],
      },
    ] as Value;

    const result = discardPendingEventSuggestionsFromState({
      content,
      discussions: [
        {
          id: 'discussion-confirmed',
          changeRequestEntityId: 'cr-row-1',
          confirmationStatus: 'confirmed',
        },
      ],
    });

    expect(result.changed).toBe(false);
    expect(result.removedCount).toBe(0);
    expect(result.discussions).toHaveLength(1);
    expect(textContent(result.content)).toContain('Eingereicht');
  });
});
