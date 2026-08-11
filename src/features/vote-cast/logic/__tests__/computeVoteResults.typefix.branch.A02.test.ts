import { describe, expect, it } from 'vitest';

import {
  computeVoteResultSummary,
  tallyFinalChoiceResults,
  type ChoiceInfo,
} from '../computeVoteResults';

function changingIdChoice(label: string, stableReads: number, stableId: string): ChoiceInfo {
  let reads = 0;
  return {
    get id() {
      reads += 1;
      return reads <= stableReads ? stableId : `${stableId}-changed-${reads}`;
    },
    label,
    order_index: label === 'Yes' ? 0 : 1,
  };
}

describe('computeVoteResults post-typefix fallbacks', () => {
  it('defaults a tally to zero when a mutable integration record changes its id', () => {
    const choice = changingIdChoice('Yes', 1, 'yes');

    expect(tallyFinalChoiceResults([choice], [], [])).toEqual([
      expect.objectContaining({ count: 0 }),
    ]);
  });

  it('defaults both decisive counts when their source records no longer match the tallies', () => {
    const accept = changingIdChoice('Yes', 3, 'yes');
    const reject = changingIdChoice('No', 3, 'no');

    const summary = computeVoteResultSummary([accept, reject], [], 2, 'simple');

    expect(summary.result).toBe('tie');
    expect(summary.totalVoted).toBe(0);
  });

  it('keeps a passed result while defaulting a vanished winning percentage to null', () => {
    const accept = changingIdChoice('Yes', 4, 'yes');
    const reject = changingIdChoice('No', Number.POSITIVE_INFINITY, 'no');

    const summary = computeVoteResultSummary([accept, reject], [{ choice_id: 'yes' }], 1, 'simple');

    expect(summary).toMatchObject({ result: 'passed', winningPercent: null });
  });

  it('keeps a rejected result while defaulting a vanished winning percentage to null', () => {
    const accept = changingIdChoice('Yes', Number.POSITIVE_INFINITY, 'yes');
    const reject = changingIdChoice('No', 5, 'no');

    const summary = computeVoteResultSummary([accept, reject], [{ choice_id: 'no' }], 1, 'simple');

    expect(summary).toMatchObject({ result: 'rejected', winningPercent: null });
  });
});
