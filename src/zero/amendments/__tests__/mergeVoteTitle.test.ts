import { describe, expect, it } from 'vitest';

import {
  buildMergeVoteTitle,
  getMergeVoteBranchLabel,
  getOrderedMergeVoteBranches,
} from '../merge-vote-title';

describe('merge vote titles', () => {
  it('orders numeric, date, invalid, and missing timestamps with id tie breaks', () => {
    const branches = [
      { id: 'z', created_at: null },
      { id: 'd', created_at: '2025-01-02T00:00:00.000Z' },
      { id: 'c', created_at: 'invalid' },
      { id: 'b', created_at: 2 },
      { id: 'a', created_at: 2 },
    ];
    expect(getOrderedMergeVoteBranches(branches).map(branch => branch.id)).toEqual([
      'c',
      'z',
      'a',
      'b',
      'd',
    ]);
    expect(branches.map(branch => branch.id)).toEqual(['z', 'd', 'c', 'b', 'a']);
  });

  it('uses trimmed titles and numbered fallback labels', () => {
    expect(getMergeVoteBranchLabel({ id: 'one', title: ' Named ' }, 0)).toBe('Named');
    expect(getMergeVoteBranchLabel({ id: 'two', title: ' ' }, 1)).toContain('2');
    expect(getMergeVoteBranchLabel({ id: 'three' }, 2)).toContain('3');
  });

  it('builds merge titles and preserves a plain title for an empty branch list', () => {
    expect(buildMergeVoteTitle(' Amendment ', [])).toBe('Amendment');
    expect(buildMergeVoteTitle(undefined, [])).toBe('Amendment');
    expect(
      buildMergeVoteTitle(null, [
        { id: 'b', title: 'Second', created_at: 2 },
        { id: 'a', title: 'First', created_at: 1 },
      ])
    ).toContain('First');
  });
});
