import { describe, expect, it } from 'vitest';
import { resolveMergeRoundOneOutcome } from '../process-engine-logic';

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

  it('returns a tie for an empty vote or a choice without a branch candidate', () => {
    expect(
      resolveMergeRoundOneOutcome({
        vote: {
          id: 'empty-vote',
          choices: undefined,
          final_decisions: undefined,
          offline_tallies: undefined,
        } as never,
        candidateStepRuns: [],
      })
    ).toEqual({
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    });

    expect(
      resolveMergeRoundOneOutcome({
        vote: {
          id: 'unmapped-vote',
          choices: [{ id: 'choice-unmapped', label: 'Unmapped', order_index: null }],
          final_decisions: [],
          offline_tallies: [],
        } as never,
        candidateStepRuns: [],
      })
    ).toEqual({
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    });
  });

  it('combines online and final offline tallies with explicit and positional branches', () => {
    const outcome = resolveMergeRoundOneOutcome({
      vote: {
        id: 'mixed-vote',
        choices: [
          {
            id: 'choice-explicit',
            label: 'Explicit',
            order_index: null,
            process_branch_id: 'branch-explicit',
          },
          { id: 'choice-positional', label: 'Positional', order_index: 2 },
          { id: 'choice-without-branch', label: 'No branch', order_index: 3 },
        ],
        final_decisions: [{ choice_id: 'choice-explicit' }, { choice_id: 'choice-not-in-list' }],
        offline_tallies: [
          { choice_id: 'choice-explicit', phase: 'indicative', count: 99 },
          { choice_id: 'choice-positional', phase: 'final', count: 3 },
          { choice_id: 'choice-not-in-list', phase: 'final', count: 2 },
        ],
      } as never,
      candidateStepRuns: [
        { branch_id: 'candidate-unused', created_at: 10 },
        { branch_id: 'branch-positional', created_at: 20 },
      ],
    });

    expect(outcome).toEqual({
      result: 'winner',
      winnerBranchId: 'branch-positional',
      winnerChoiceId: 'choice-positional',
      loserBranchIds: ['branch-explicit'],
    });

    expect(
      resolveMergeRoundOneOutcome({
        vote: {
          choices: [
            { id: 'choice-ordered', order_index: 1 },
            { id: 'choice-null-order', order_index: null },
          ],
          final_decisions: [],
          offline_tallies: [],
        },
        candidateStepRuns,
      })
    ).toMatchObject({ result: 'tie' });
  });
});
