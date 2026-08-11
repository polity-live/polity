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

  it('resolves every inline suggestion action and property direction', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'accept replace',
            suggestion: true,
            suggestion_accept_replace: { id: 'accept-replace', type: 'replace' },
          },
          {
            text: 'accept update props',
            align: 'old',
            suggestion: true,
            suggestion_accept_update_props: {
              id: 'accept-update-props',
              type: 'update',
              newProperties: { align: 'new' },
            },
          },
          {
            text: 'accept update empty',
            suggestion: true,
            suggestion_accept_update_empty: { id: 'accept-update-empty', type: 'update' },
          },
          {
            text: 'accept unknown',
            suggestion: true,
            suggestion_accept_unknown: { id: 'accept-unknown', type: 'custom' },
          },
          {
            text: 'reject replace',
            suggestion: true,
            suggestion_reject_replace: { id: 'reject-replace', type: 'replace' },
          },
          {
            text: 'reject update props',
            align: 'new',
            suggestion: true,
            suggestion_reject_update_props: {
              id: 'reject-update-props',
              type: 'update',
              properties: { align: 'old' },
            },
          },
          {
            text: 'reject update empty',
            suggestion: true,
            suggestion_reject_update_empty: { id: 'reject-update-empty', type: 'update' },
          },
          {
            text: 'reject unknown',
            suggestion: true,
            suggestion_reject_unknown: { id: 'reject-unknown', type: 'custom' },
          },
          {
            text: 'missing mark',
            suggestion: true,
            suggestion_missing: undefined,
          },
          {
            text: 'target plus resolved',
            suggestion: true,
            suggestion_target: { id: 'target', type: 'insert' },
            suggestion_other: { id: 'other', type: 'remove' },
          },
          {
            type: 'link',
            suggestion_nested: { id: 'nested-other', type: 'remove' },
            children: [{ text: 'nested child' }],
          },
        ],
      },
    ] as any;
    const acceptIds = [
      'accept-replace',
      'accept-update-props',
      'accept-update-empty',
      'accept-unknown',
    ];
    const result = filterDocumentToSuggestions(
      content,
      new Set(['target']),
      new Map(acceptIds.map(id => [id, 'accept'] as const))
    );
    const children = firstParagraphChildren(result) as any[];

    expect(textContent(result)).not.toContain('reject replace');
    expect(children.find(node => node.text === 'accept update props')?.align).toBe('new');
    expect(children.find(node => node.text === 'reject update props')?.align).toBe('old');
    expect(children.find(node => node.text === 'accept update empty')).toBeTruthy();
    expect(children.find(node => node.text === 'reject update empty')).toBeTruthy();
    expect(children.find(node => node.text === 'accept unknown')).toBeTruthy();
    expect(children.find(node => node.text === 'reject unknown')).toBeTruthy();
    expect(children.find(node => node.text === 'missing mark')).toBeTruthy();
    expect(children.find(node => node.text === 'target plus resolved')).toMatchObject({
      suggestion: true,
      suggestion_target: { id: 'target', type: 'insert' },
    });
  });

  it('resolves replace, remove, and unknown block suggestions in both directions', () => {
    const block = (id: string | undefined, type: string) => ({
      type: 'custom-block',
      children: [{ text: id ?? 'missing' }],
      suggestion: { id, type },
    });
    const content = [
      block('reject-replace', 'replace'),
      block('reject-remove', 'remove'),
      block('reject-unknown', 'custom'),
      block('accept-unknown', 'custom'),
      block(undefined, 'remove'),
    ] as any;
    const result = filterDocumentToSuggestions(
      content,
      new Set(),
      new Map([
        ['accept-unknown', 'accept'],
        ['', 'accept'],
      ])
    ) as any[];

    expect(result).toHaveLength(3);
    expect(result.map(node => node.children[0].text)).toEqual([
      'reject-remove',
      'reject-unknown',
      'accept-unknown',
    ]);
    expect(result.every(node => !('suggestion' in node))).toBe(true);
  });

  it('recurses through ordinary content and tolerates malformed block markers', () => {
    const content = [
      { text: 'leaf', suggestion: true },
      { type: 'p', suggestion: null, children: [{ text: 'null marker' }] },
      { type: 'p', suggestion: [], children: [{ text: 'array marker' }] },
      { type: 'p', suggestion: 'invalid', children: [{ text: 'string marker' }] },
      null,
      'primitive',
    ] as any;

    const result = filterDocumentToSuggestions(content, new Set()) as any[];

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ text: 'leaf' });
    expect(result[1].children[0].text).toBe('null marker');
  });
});
