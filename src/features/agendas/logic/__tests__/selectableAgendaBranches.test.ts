import { describe, expect, it } from 'vitest';
import {
  getSelectableAgendaBranches,
  resolveSelectableAgendaBranchId,
  type SelectableAgendaBranchVote,
} from '../selectableAgendaBranches';

const branches = [
  { id: 'branch-a', title: 'Branch A', created_at: 1 },
  { id: 'branch-b', title: 'Branch B', created_at: 2 },
  { id: 'branch-c', title: 'Branch C', created_at: 3 },
];

describe('selectableAgendaBranches', () => {
  it('keeps only the current step branch for non-merge agenda items', () => {
    const result = getSelectableAgendaBranches({
      branches,
      vote: { purpose: 'final_closing' },
      agendaStepRuns: [
        { id: 'step-a', branch_id: 'branch-a', step_kind: 'event_vote' },
        { id: 'step-b', branch_id: 'branch-b', step_kind: 'event_vote' },
      ],
      currentStepRun: { id: 'step-b', branch_id: 'branch-b' },
    });

    expect(result.isMergeAgendaItem).toBe(false);
    expect(result.preferredBranchId).toBe('branch-b');
    expect(result.branches.map(branch => branch.id)).toEqual(['branch-b']);
  });

  it('uses merge vote choice branch ids as the selectable branches', () => {
    const mergeVote: SelectableAgendaBranchVote = {
      purpose: 'merge_variant',
      choices: [
        { process_branch_id: 'branch-c', order_index: 1 },
        { process_branch_id: 'branch-a', order_index: 0 },
      ],
    };

    const result = getSelectableAgendaBranches({
      branches,
      vote: mergeVote,
      votes: [mergeVote],
      currentStepRun: { id: 'step-b', branch_id: 'branch-b' },
    });

    expect(result.isMergeAgendaItem).toBe(true);
    expect(result.preferredBranchId).toBeNull();
    expect(result.branches.map(branch => branch.id)).toEqual(['branch-a', 'branch-c']);
  });

  it('falls back to merge step runs when vote choices are not branch-scoped yet', () => {
    const result = getSelectableAgendaBranches({
      branches,
      vote: { purpose: 'merge_variant', choices: [{ order_index: 0 }, { order_index: 1 }] },
      agendaStepRuns: [
        {
          id: 'step-c',
          branch_id: 'branch-c',
          step_kind: 'merge_vote',
          branch: { id: 'branch-c', created_at: 3 },
        },
        {
          id: 'step-a',
          branch_id: 'branch-a',
          step_kind: 'merge_vote',
          branch: { id: 'branch-a', created_at: 1 },
        },
      ],
      currentStepRun: { id: 'step-b', branch_id: 'branch-b' },
    });

    expect(result.branches.map(branch => branch.id)).toEqual(['branch-a', 'branch-c']);
  });

  it('ignores stale requested branch ids when resolving the selected branch', () => {
    expect(
      resolveSelectableAgendaBranchId({
        branches: [branches[1]],
        requestedBranchId: 'branch-a',
        preferredBranchId: 'branch-b',
      })
    ).toBe('branch-b');

    expect(
      resolveSelectableAgendaBranchId({
        branches: [branches[0], branches[2]],
        requestedBranchId: 'branch-b',
      })
    ).toBe('branch-a');
  });
});
