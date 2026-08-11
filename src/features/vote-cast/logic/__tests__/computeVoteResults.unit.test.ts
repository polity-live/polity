import { describe, expect, it } from 'vitest';
import { computeVoteResultSummary, tallyFinalChoiceResults } from '../computeVoteResults';

describe('computeVoteResultSummary', () => {
  it('handles empty choices and ignored or unknown ballot data', () => {
    expect(
      tallyFinalChoiceResults(
        [],
        [{ choice_id: 'unknown' }],
        [
          { phase: 'indicative', choice_id: 'unknown', count: 10 },
          { phase: 'final', choice_id: null, count: 10 },
          { phase: 'final', choice_id: 'unknown', count: null },
        ]
      )
    ).toEqual([]);
    expect(
      tallyFinalChoiceResults([], [], [{ phase: 'final', choice_id: 'unknown', count: null }])
    ).toEqual([]);

    expect(computeVoteResultSummary([], [], 0, 'simple')).toEqual({
      result: 'tie',
      choiceTallies: [],
      totalEligible: 0,
      totalVoted: 0,
      winningChoiceId: null,
      winningLabel: null,
      winningPercent: null,
      majorityType: 'simple',
    });
  });

  it('resolves an offline-only accept tally as passed instead of tie', () => {
    const summary = computeVoteResultSummary(
      [
        { id: 'abstain', label: 'abstain', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
        { id: 'accept', label: 'accept', order_index: 2 },
      ],
      [],
      1,
      'simple',
      [{ phase: 'final', choice_id: 'accept', count: 1 }]
    );

    expect(summary.result).toBe('passed');
    expect(summary.totalVoted).toBe(1);
    expect(summary.winningChoiceId).toBe('accept');
    expect(summary.winningPercent).toBe(100);
  });

  it('resolves the winning share from aggregated online and offline final tallies', () => {
    const summary = computeVoteResultSummary(
      [
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
        { id: 'abstain', label: 'abstain', order_index: 2 },
      ],
      [{ choice_id: 'accept' }, { choice_id: 'reject' }],
      3,
      'simple',
      [{ phase: 'final', choice_id: 'reject', count: 1 }]
    );

    expect(summary.result).toBe('rejected');
    expect(summary.totalVoted).toBe(3);
    expect(summary.winningChoiceId).toBe('reject');
    expect(summary.winningPercent).toBe(67);
    expect(summary.choiceTallies.find(tally => tally.choiceId === 'accept')?.count).toBe(1);
    expect(summary.choiceTallies.find(tally => tally.choiceId === 'reject')?.count).toBe(2);
  });

  it('treats yes and no labels as decisive legacy vote labels', () => {
    const summary = computeVoteResultSummary(
      [
        { id: 'yes', label: 'Yes', order_index: 0 },
        { id: 'no', label: 'No', order_index: 1 },
        { id: 'abstain', label: 'Abstain', order_index: 2 },
      ],
      [{ choice_id: 'yes' }],
      3,
      'simple',
      [{ phase: 'final', choice_id: 'no', count: 2 }]
    );

    expect(summary.result).toBe('rejected');
    expect(summary.winningChoiceId).toBe('no');
  });

  it('falls back to ordered choices when decisive labels are missing', () => {
    const summary = computeVoteResultSummary(
      [
        { id: 'option-a', label: 'Option A', order_index: 0 },
        { id: 'option-b', label: 'Option B', order_index: 1 },
        { id: 'option-c', label: 'Option C', order_index: 2 },
      ],
      [{ choice_id: 'option-a' }],
      3,
      'simple',
      [{ phase: 'final', choice_id: 'option-b', count: 2 }]
    );

    expect(summary.result).toBe('rejected');
    expect(summary.winningChoiceId).toBe('option-b');
    expect(summary.winningPercent).toBe(67);
  });
});
