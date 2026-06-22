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
});
