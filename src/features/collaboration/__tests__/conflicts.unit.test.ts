import { describe, expect, it } from 'vitest';
import { proposalConflicts } from '../logic/conflicts';
import { validateTextProposal } from '../logic/proposals';
describe('proposal application safety', () => {
  it('does not conflict with an unchanged proposal even when the current document diverged', () => {
    expect(
      proposalConflicts({ title: 'Other edit' }, { title: 'Base' }, { title: 'Base' })
    ).toEqual([]);
  });
  it('submits a marked insertion into an existing empty paragraph without allowing an extra unmarked block', () => {
    const base = [{ id: 'empty', type: 'p', children: [{ text: '' }] }];
    const draft = [
      {
        id: 'empty',
        type: 'p',
        children: [
          { text: 'Mehr Schatten', suggestion: true, suggestion_a: { id: 'a', type: 'insert' } },
        ],
      },
    ];
    expect(validateTextProposal(base, draft)).toEqual(['a']);
    expect(() =>
      validateTextProposal(base, [
        ...draft,
        { id: 'forged', type: 'p', children: [{ text: 'Unmarked' }] },
      ])
    ).toThrow('unmarked_proposal_changes');
  });
  it('allows a price decision after an independent geometry edit', () => {
    expect(
      proposalConflicts(
        { price: 10, geometry: [2, 3] },
        { price: 10, geometry: [0, 1] },
        { price: 20, geometry: [0, 1] }
      )
    ).toEqual([]);
  });
  it('reports a conflicting price without overwriting it', () => {
    expect(proposalConflicts({ price: 12 }, { price: 10 }, { price: 20 })).toEqual(['/price']);
  });
  it('treats geometry as one value and detects competing insertion/deletion', () => {
    expect(
      proposalConflicts(
        { geometry: { x: 1, z: 4 } },
        { geometry: { x: 1, z: 2 } },
        { geometry: { x: 3, z: 2 } }
      )
    ).toEqual(['/geometry']);
    expect(proposalConflicts({ id: 'same' }, null, { id: 'same' })).toEqual(['/']);
    expect(proposalConflicts({ price: 12 }, { price: 10 }, null)).toEqual(['/']);
  });
  it('does not accept an unmarked rewrite from a suggestion-only draft', () => {
    const base = [{ id: 'p', type: 'p', children: [{ text: 'Original' }] }];
    const draft = [
      {
        id: 'p',
        type: 'p',
        children: [
          { text: 'Rewritten' },
          { text: 'new', suggestion_a: { id: 'a', type: 'insert', userId: 'u' } },
        ],
      },
    ];
    expect(() => validateTextProposal(base, draft)).toThrow('unmarked_proposal_changes');
  });
  it('accepts an insertion only when rejecting its mark recovers the base', () => {
    const base = [{ id: 'p', type: 'p', children: [{ text: 'Original' }] }];
    const draft = [
      {
        id: 'p',
        type: 'p',
        children: [
          { text: 'Original' },
          { text: 'new', suggestion_a: { id: 'a', type: 'insert', userId: 'u' } },
        ],
      },
    ];
    expect(validateTextProposal(base, draft)).toEqual(['a']);
  });
});
