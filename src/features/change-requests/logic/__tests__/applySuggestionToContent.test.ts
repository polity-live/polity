import { describe, expect, it } from 'vitest';
import type { Value } from 'platejs';

import {
  applyResolvedSuggestionsToContent,
  applySuggestionToContent,
} from '../applySuggestionToContent';

function textContent(content: Value) {
  return JSON.stringify(content);
}

function chartBlock(suggestion: {
  id: string;
  type: 'insert' | 'remove' | 'update';
  properties?: Record<string, unknown>;
  newProperties?: Record<string, unknown>;
}) {
  return {
    chartType: 'bar',
    children: [{ text: '' }],
    presentation: {},
    query: { aggregation: 'sum', filters: {} },
    source: { datasetId: 'dataset-id', kind: 'dataset', provider: 'UPLOAD' },
    suggestion,
    type: 'data_view',
    view: 'chart',
  };
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

  it('accepts inserted charts without retaining the block suggestion highlight', () => {
    const content = [chartBlock({ id: 'chart-insert', type: 'insert' })] as Value;

    const accepted = applySuggestionToContent(content, 'chart-insert', 'accept');
    const rejected = applySuggestionToContent(content, 'chart-insert', 'reject');

    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ type: 'data_view', view: 'chart' });
    expect('suggestion' in accepted[0]).toBe(false);
    expect(rejected).toEqual([]);
  });

  it('removes accepted chart removals and clears rejected removal highlights', () => {
    const content = [chartBlock({ id: 'chart-remove', type: 'remove' })] as Value;

    expect(applySuggestionToContent(content, 'chart-remove', 'accept')).toEqual([]);
    const rejected = applySuggestionToContent(content, 'chart-remove', 'reject');
    expect(rejected).toHaveLength(1);
    expect('suggestion' in rejected[0]).toBe(false);
  });

  it('applies chart property updates and removes the block suggestion highlight', () => {
    const content = [
      chartBlock({
        id: 'chart-update',
        type: 'update',
        properties: { chartType: 'bar' },
        newProperties: { chartType: 'line' },
      }),
    ] as Value;

    const accepted = applySuggestionToContent(content, 'chart-update', 'accept');
    const rejected = applySuggestionToContent(content, 'chart-update', 'reject');

    expect(accepted[0]).toMatchObject({ chartType: 'line' });
    expect(rejected[0]).toMatchObject({ chartType: 'bar' });
    expect('suggestion' in accepted[0]).toBe(false);
    expect('suggestion' in rejected[0]).toBe(false);
  });

  it('cleans accepted chart highlights when replaying persisted decisions', () => {
    const content = [chartBlock({ id: 'accepted-chart', type: 'insert' })] as Value;

    const resolved = applyResolvedSuggestionsToContent(content, [
      {
        suggestion_id: 'accepted-chart',
        status: 'accepted',
        voting_status: 'completed',
        created_at: 1,
      },
    ]);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ type: 'data_view', view: 'chart' });
    expect('suggestion' in resolved[0]).toBe(false);
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
