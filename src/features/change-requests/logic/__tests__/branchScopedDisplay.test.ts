import { describe, expect, it } from 'vitest';
import { filterTimelineItemsForProcessBranch } from '../branchScopedDisplay';

describe('branchScopedDisplay', () => {
  it('keeps sequence boundary votes while filtering timeline items by process branch', () => {
    const items = [
      {
        id: 'variant-vote',
        _voteStepKind: 'variant_selection',
        change_request: null,
      },
      {
        id: 'branch-a-cr',
        change_request: { id: 'cr-a', process_branch_id: 'branch-a' },
      },
      {
        id: 'branch-b-cr',
        change_request: { id: 'cr-b', process_branch_id: 'branch-b' },
      },
      {
        id: 'closing-vote',
        is_final_vote: true,
        change_request: null,
      },
    ];

    expect(filterTimelineItemsForProcessBranch(items, 'branch-b').map(item => item.id)).toEqual([
      'variant-vote',
      'branch-b-cr',
      'closing-vote',
    ]);
  });
});
