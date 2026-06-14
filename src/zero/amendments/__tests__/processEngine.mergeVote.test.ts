import { describe, expect, it } from 'vitest';
import { resolveMergeRoundOneOutcome } from '../process-engine';

function buildMergeVote(args: { choice1: number; choice2: number }) {
  return {
    id: 'vote-merge-1',
    choices: [
      { id: 'choice-1', label: 'Antrag 1', order_index: 1 },
      { id: 'choice-2', label: 'Antrag 2', order_index: 2 },
    ],
    final_decisions: [
      ...Array.from({ length: args.choice1 }, () => ({ choice_id: 'choice-1' })),
      ...Array.from({ length: args.choice2 }, () => ({ choice_id: 'choice-2' })),
    ],
    offline_tallies: [],
  };
}

const candidateStepRuns = [
  { branch_id: 'branch-original', created_at: 10 },
  { branch_id: 'branch-clone', created_at: 20 },
] as const;

describe('resolveMergeRoundOneOutcome', () => {
  it('selects the relative-majority winner and marks all other branches as losers', () => {
    const outcome = resolveMergeRoundOneOutcome({
      vote: buildMergeVote({ choice1: 2, choice2: 5 }) as never,
      candidateStepRuns,
    });

    expect(outcome).toEqual({
      result: 'winner',
      winnerBranchId: 'branch-clone',
      winnerChoiceId: 'choice-2',
      loserBranchIds: ['branch-original'],
    });
  });

  it('returns a tie without a winner when the leading variants have equal votes', () => {
    const outcome = resolveMergeRoundOneOutcome({
      vote: buildMergeVote({ choice1: 3, choice2: 3 }) as never,
      candidateStepRuns,
    });

    expect(outcome).toEqual({
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    });
  });
});
