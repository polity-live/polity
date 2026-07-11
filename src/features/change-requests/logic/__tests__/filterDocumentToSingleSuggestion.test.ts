import type { Value } from 'platejs';
import { describe, expect, it } from 'vitest';

import { filterDocumentToSuggestions } from '../filterDocumentToSingleSuggestion';

function textContent(content: Value) {
  return content
    .flatMap(node => ('children' in node && Array.isArray(node.children) ? node.children : [node]))
    .map(node => ('text' in node ? node.text : ''))
    .join('');
}

function firstParagraphChildren(content: Value) {
  const [paragraph] = content;
  return 'children' in paragraph && Array.isArray(paragraph.children) ? paragraph.children : [];
}

const chartBlock = (suggestion: { id: string; type: string }) => ({
  chartType: 'bar',
  children: [{ text: '' }],
  presentation: {},
  query: { aggregation: 'sum', filters: {} },
  source: {
    datasetId: 'dataset-id',
    kind: 'dataset',
    provider: 'UPLOAD',
    snapshotId: 'snapshot-id',
    title: 'Dataset',
  },
  suggestion,
  type: 'data_view',
  view: 'chart',
});

describe('filterDocumentToSuggestions', () => {
  it('applies decided suggestions and keeps only the target suggestion visible', () => {
    const content = [
      {
        type: 'p',
        children: [
          { text: 'Base ' },
          {
            text: 'accepted insert ',
            suggestion: true,
            suggestion_accepted_insert: { id: 'accepted-insert', type: 'insert' },
          },
          {
            text: 'rejected insert ',
            suggestion: true,
            suggestion_rejected_insert: { id: 'rejected-insert', type: 'insert' },
          },
          {
            text: 'pending insert ',
            suggestion: true,
            suggestion_pending_insert: { id: 'pending-insert', type: 'insert' },
          },
          {
            text: 'accepted removal ',
            suggestion: true,
            suggestion_accepted_remove: { id: 'accepted-remove', type: 'remove' },
          },
          {
            text: 'rejected removal ',
            suggestion: true,
            suggestion_rejected_remove: { id: 'rejected-remove', type: 'remove' },
          },
          {
            text: 'target insert',
            suggestion: true,
            suggestion_target_insert: { id: 'target-insert', type: 'insert' },
          },
        ],
      },
    ] as Value;

    const result = filterDocumentToSuggestions(
      content,
      new Set(['target-insert']),
      new Map([
        ['accepted-insert', 'accept'],
        ['rejected-insert', 'reject'],
        ['accepted-remove', 'accept'],
        ['rejected-remove', 'reject'],
      ])
    );
    const previewText = textContent(result);

    expect(previewText).toContain('Base');
    expect(previewText).toContain('accepted insert');
    expect(previewText).not.toContain('rejected insert');
    expect(previewText).not.toContain('pending insert');
    expect(previewText).not.toContain('accepted removal');
    expect(previewText).toContain('rejected removal');
    expect(previewText).toContain('target insert');
    expect(firstParagraphChildren(result).some(node => 'suggestion_target_insert' in node)).toBe(
      true
    );
  });

  it('keeps target block inserts visible with their suggestion mark', () => {
    const content = [chartBlock({ id: 'target-insert', type: 'insert' })] as Value;

    const result = filterDocumentToSuggestions(content, new Set(['target-insert']));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      suggestion: { id: 'target-insert', type: 'insert' },
      type: 'data_view',
    });
  });

  it('removes non-target pending block inserts', () => {
    const content = [chartBlock({ id: 'pending-insert', type: 'insert' })] as Value;

    const result = filterDocumentToSuggestions(content, new Set(['target-insert']));

    expect(result).toEqual([]);
  });

  it('keeps accepted non-target block inserts without suggestion marks', () => {
    const content = [chartBlock({ id: 'accepted-insert', type: 'insert' })] as Value;

    const result = filterDocumentToSuggestions(
      content,
      new Set(['target-insert']),
      new Map([['accepted-insert', 'accept']])
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'data_view' });
    expect('suggestion' in result[0]).toBe(false);
  });

  it('keeps target block removals visible with their suggestion mark', () => {
    const content = [chartBlock({ id: 'target-remove', type: 'remove' })] as Value;

    const result = filterDocumentToSuggestions(content, new Set(['target-remove']));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      suggestion: { id: 'target-remove', type: 'remove' },
      type: 'data_view',
    });
  });

  it('removes accepted non-target block removals', () => {
    const content = [chartBlock({ id: 'accepted-remove', type: 'remove' })] as Value;

    const result = filterDocumentToSuggestions(
      content,
      new Set(['target-insert']),
      new Map([['accepted-remove', 'accept']])
    );

    expect(result).toEqual([]);
  });
});
