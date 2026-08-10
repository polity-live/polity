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

  it('accepts and rejects inline replacements', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'replacement',
            suggestion: true,
            suggestion_replace: { id: 'replace', type: 'replace' },
          },
        ],
      },
    ] as Value;

    expect(textContent(applySuggestionToContent(content, 'replace', 'accept'))).toContain(
      'replacement'
    );
    expect(textContent(applySuggestionToContent(content, 'replace', 'reject'))).not.toContain(
      'replacement'
    );
  });

  it('applies or restores inline update properties and handles missing property snapshots', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'with properties',
            align: 'current',
            suggestion: true,
            suggestion_update: {
              id: 'update',
              type: 'update',
              properties: { align: 'old' },
              newProperties: { align: 'new' },
            },
          },
          {
            text: 'without properties',
            suggestion: true,
            suggestion_update_empty: { id: 'update-empty', type: 'update' },
          },
        ],
      },
    ] as any;

    const accepted = applySuggestionToContent(content, 'update', 'accept') as any[];
    const rejected = applySuggestionToContent(content, 'update', 'reject') as any[];
    expect(accepted[0].children[0].align).toBe('new');
    expect(rejected[0].children[0].align).toBe('old');

    const acceptedEmpty = applySuggestionToContent(content, 'update-empty', 'accept') as any[];
    const rejectedEmpty = applySuggestionToContent(content, 'update-empty', 'reject') as any[];
    expect(acceptedEmpty[0].children[1].text).toBe('without properties');
    expect(rejectedEmpty[0].children[1].text).toBe('without properties');
  });

  it('strips unknown marks while preserving other active suggestions', () => {
    const content = [
      {
        text: 'mixed',
        suggestion: true,
        suggestion_unknown: { id: 'unknown', type: 'custom' },
        suggestion_other: { id: 'other', type: 'insert' },
      },
      { text: 'plain' },
    ] as any;

    const result = applySuggestionToContent(content, 'unknown', 'accept') as any[];
    expect(result[0]).toMatchObject({
      text: 'mixed',
      suggestion: true,
      suggestion_other: { id: 'other', type: 'insert' },
    });
    expect(result[1]).toEqual({ text: 'plain' });
  });

  it('handles block replacements, unknown marks, and updates without properties', () => {
    const replace = {
      type: 'custom',
      children: [{ text: 'replace' }],
      suggestion: { id: 'block-replace', type: 'replace' },
    } as any;
    expect(applySuggestionToContent([replace], 'block-replace', 'accept')).toHaveLength(1);
    expect(applySuggestionToContent([replace], 'block-replace', 'reject')).toEqual([]);

    for (const type of ['update', 'custom']) {
      const block = {
        type: 'custom',
        children: [{ text: type }],
        suggestion: { id: `block-${type}`, type },
      } as any;
      expect(applySuggestionToContent([block], `block-${type}`, 'accept')[0]).not.toHaveProperty(
        'suggestion'
      );
      expect(applySuggestionToContent([block], `block-${type}`, 'reject')[0]).not.toHaveProperty(
        'suggestion'
      );
    }
  });

  it('ignores malformed, unrelated, and absent block suggestion data', () => {
    const content = [
      { type: 'p', suggestion: null, children: [{ text: 'null' }] },
      { type: 'p', suggestion: [], children: [{ text: 'array' }] },
      { type: 'p', suggestion: 'invalid', children: [{ text: 'string' }] },
      {
        type: 'p',
        suggestion: { id: 'other', type: 'insert' },
        children: [{ text: 'other' }],
      },
    ] as any;

    expect(applySuggestionToContent(content, 'target', 'accept')).toHaveLength(4);
  });

  it('filters unresolved decisions and replays all final status aliases in creation order', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'approved insert',
            suggestion: true,
            suggestion_approved: { id: 'approved', type: 'insert' },
          },
          {
            text: 'declined remove',
            suggestion: true,
            suggestion_declined: { id: 'declined', type: 'remove' },
          },
        ],
      },
    ] as Value;
    const decisions = [
      { suggestion_id: 'ignored-open', status: 'accepted', voting_status: 'open' },
      { suggestion_id: null, status: 'accepted', voting_status: 'completed' },
      { suggestion_id: 'ignored-status', status: 'open', voting_status: 'completed' },
      {
        suggestion_id: 'ignored-null-status',
        status: null,
        voting_status: 'completed',
      },
      {
        suggestion_id: 'approved',
        status: 'approved',
        voting_status: 'completed',
        created_at: null,
      },
      {
        suggestion_id: 'declined',
        status: 'declined',
        voting_status: 'completed',
        created_at: 2,
      },
    ];

    const result = applyResolvedSuggestionsToContent(content, decisions);
    expect(textContent(result)).toContain('approved insert');
    expect(textContent(result)).toContain('declined remove');
    expect(textContent(result)).not.toContain('suggestion_approved');
    expect(textContent(result)).not.toContain('suggestion_declined');

    applyResolvedSuggestionsToContent(content, [...decisions].reverse());
  });
});
