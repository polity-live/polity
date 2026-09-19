import { describe, it, expect } from 'vitest';
import type { Value } from 'platejs';
import {
  isolateProposal,
  mergeProposal,
  normalized,
  suggestionIds,
  validateTextProposal,
} from '../logic/proposals';
const p = (id: string, text: string) => ({ id, type: 'p', children: [{ text }] });
const draft: Value = [
  {
    id: 'p',
    type: 'p',
    children: [
      { text: 'Base' },
      { text: ' private', suggestion: true, suggestion_a: { id: 'a', type: 'insert' } },
      { text: ' public', suggestion: true, suggestion_b: { id: 'b', type: 'insert' } },
    ],
  },
];
describe('isolated immutable proposals', () => {
  it('rejects empty proposals and unmarked main-text rewrites while ignoring unrelated primitive metadata', () => {
    expect([...suggestionIds([null, 1, 'text', { children: [{ text: 'x' }] }])]).toEqual([]);
    expect(normalized('legacy')).toBe('legacy');
    expect(() => validateTextProposal([p('p', 'Base')], [p('p', 'Base')])).toThrow(
      'proposal_has_no_changes'
    );
    const changed = structuredClone(draft);
    changed[0].children[0].text = 'Rewritten';
    expect(() => validateTextProposal([p('p', 'Base')], changed)).toThrow(
      'unmarked_proposal_changes'
    );
    expect(() => mergeProposal(null, 1, 2)).toThrow('proposal_content_conflict');
    expect(() => mergeProposal([1], [2, 3], [1, 4])).toThrow('proposal_content_conflict');
    expect(mergeProposal({ a: 1, b: 2 }, { b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
    expect(mergeProposal('alpha beta gamma', 'alpha beta GAMMA', 'ALPHA beta gamma')).toBe(
      'ALPHA beta GAMMA'
    );
  });
  it('never includes another proposal in an authorized preview', () => {
    const view = isolateProposal(draft, 'b');
    expect(JSON.stringify(view)).not.toContain('private');
    expect(JSON.stringify(view)).toContain('suggestion_b');
    expect(isolateProposal(draft, 'b', true)).toEqual([p('p', 'Base public')]);
    expect(validateTextProposal([p('p', 'Base')], draft)).toEqual(['a', 'b']);
  });
  it('applies only the decided change while preserving independent edits', () => {
    const base = [p('p', 'Base'), p('q', 'Second')];
    const submitted = [p('p', 'Base public'), p('q', 'Second')];
    const current = [p('p', 'Base'), p('q', 'Changed remotely')];
    expect(mergeProposal(base, submitted, current)).toEqual([
      p('p', 'Base public'),
      p('q', 'Changed remotely'),
    ]);
  });
  it('merges disjoint text edits and refuses overlapping edits', () => {
    expect(mergeProposal('alpha beta gamma', 'ALPHA beta gamma', 'alpha beta GAMMA')).toBe(
      'ALPHA beta GAMMA'
    );
    expect(() => mergeProposal('text', 'first', 'second')).toThrow('proposal_content_conflict');
    expect(() => mergeProposal('x', 'ax', 'bx')).toThrow('proposal_content_conflict');
  });
  it('does not discard edits to a deleted object or resurrect a deleted target', () => {
    const base = [p('p', 'Base'), p('q', 'Second')];
    expect(() =>
      mergeProposal(base, [p('q', 'Second')], [p('p', 'Edited'), p('q', 'Second')])
    ).toThrow('proposal_deleted_target_conflict');
    expect(() =>
      mergeProposal(base, [p('p', 'Edited'), p('q', 'Second')], [p('q', 'Second')])
    ).toThrow('proposal_deleted_target_conflict');
  });
  it('keeps remote additions when the proposal leaves order unchanged', () => {
    expect(mergeProposal([p('p', 'A')], [p('p', 'B')], [p('p', 'A'), p('r', 'Remote')])).toEqual([
      p('p', 'B'),
      p('r', 'Remote'),
    ]);
  });
  it('refuses conflicting insertions and reordering', () => {
    expect(() =>
      mergeProposal([p('a', 'A')], [p('b', 'B'), p('a', 'A')], [p('c', 'C'), p('a', 'A')])
    ).toThrow('proposal_order_conflict');
  });
  it('accepts the same agreed reorder while preserving separate edits within its objects', () => {
    expect(
      mergeProposal(
        [p('a', 'A'), p('b', 'B')],
        [p('b', 'Proposed B'), p('a', 'A')],
        [p('b', 'B'), p('a', 'Remote A')]
      )
    ).toEqual([p('b', 'Proposed B'), p('a', 'Remote A')]);
  });
  it('normalizes equivalent split leaves without discarding formatting', () => {
    expect(
      normalized([
        { children: [{ text: 'a', bold: true }, { text: 'b', bold: true }, { text: 'c' }] },
      ])
    ).toEqual([{ children: [{ text: 'ab', bold: true }, { text: 'c' }] }]);
  });
});
