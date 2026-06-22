import { describe, expect, it } from 'vitest';
import {
  decorateBranchScopedTimelineItems,
  filterTimelineItemsForProcessBranch,
} from '../branchScopedDisplay';

describe('branchScopedDisplay', () => {
  it('keeps sequence boundary votes while filtering timeline items by process branch', () => {
    const items = [
      {
        id: 'variant-vote',
        _voteStepKind: 'merge_variant',
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
        is_closing_vote: true,
        change_request: null,
      },
    ];

    expect(filterTimelineItemsForProcessBranch(items, 'branch-b').map(item => item.id)).toEqual([
      'variant-vote',
      'branch-b-cr',
      'closing-vote',
    ]);
  });

  it('keeps branch-scoped display ids and generated CR titles aligned', () => {
    const items = [
      {
        id: 'timeline-1',
        change_request_id: 'cr-1',
        order_index: 0,
        is_closing_vote: false,
        change_request: {
          id: 'cr-1',
          process_branch_id: 'branch-a',
          cr_id: 'CR-1',
          title: 'CR-1',
        },
      },
      {
        id: 'timeline-2',
        change_request_id: 'cr-2',
        order_index: 1,
        is_closing_vote: false,
        change_request: {
          id: 'cr-2',
          process_branch_id: 'branch-a',
          cr_id: 'CR-2',
          title: 'CR-2',
        },
      },
      {
        id: 'timeline-3',
        change_request_id: 'cr-3',
        order_index: 2,
        is_closing_vote: false,
        change_request: {
          id: 'cr-3',
          process_branch_id: 'branch-a',
          cr_id: 'CR-3',
          title: 'CR-3',
        },
      },
      {
        id: 'timeline-4',
        change_request_id: 'cr-4',
        order_index: 3,
        is_closing_vote: false,
        change_request: {
          id: 'cr-4',
          process_branch_id: 'branch-a',
          cr_id: 'CR-3',
          title: 'CR-3',
        },
      },
    ];

    const decorated = decorateBranchScopedTimelineItems([{ id: 'branch-a', created_at: 1 }], items);

    expect(decorated.map(item => (item.change_request as any)?.display_cr_id)).toEqual([
      'Branch 1 CR-1',
      'Branch 1 CR-2',
      'Branch 1 CR-3',
      'Branch 1 CR-4',
    ]);
    expect(decorated.map(item => (item.change_request as any)?.title)).toEqual([
      'CR-1',
      'CR-2',
      'CR-3',
      'CR-4',
    ]);
    expect(decorated.map(item => (item.change_request as any)?.cr_id)).toEqual([
      'CR-1',
      'CR-2',
      'CR-3',
      'CR-4',
    ]);
  });

  it('uses persisted branch sequence numbers instead of agenda order for labels', () => {
    const items = [
      {
        id: 'timeline-later',
        change_request_id: 'cr-later',
        order_index: 0,
        is_closing_vote: false,
        change_request: {
          id: 'cr-later',
          process_branch_id: 'branch-a',
          title: 'CR-9',
          branch_sequence_number: 9,
        },
      },
      {
        id: 'timeline-earlier',
        change_request_id: 'cr-earlier',
        order_index: 1,
        is_closing_vote: false,
        change_request: {
          id: 'cr-earlier',
          process_branch_id: 'branch-a',
          title: 'CR-2',
          branch_sequence_number: 2,
        },
      },
    ];

    const decorated = decorateBranchScopedTimelineItems([{ id: 'branch-a', created_at: 1 }], items);

    expect(decorated.map(item => (item.change_request as any)?.display_cr_id)).toEqual([
      'Branch 1 CR-9',
      'Branch 1 CR-2',
    ]);
    expect(decorated.map(item => (item.change_request as any)?.title)).toEqual(['CR-9', 'CR-2']);
  });
});
