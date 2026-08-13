import { describe, expect, it } from 'vitest';

import { electionWinnerResolutionTestApi } from '../server-mutators';

describe('election server typefix branches', () => {
  it('keeps sorting deterministic when candidate identifiers change after tallying', () => {
    const changingCandidate = (initialId: string, laterId: string, orderIndex: number) => {
      let reads = 0;
      return {
        get id() {
          reads += 1;
          return reads === 1 ? initialId : laterId;
        },
        order_index: orderIndex,
      };
    };

    const result = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates: [
        changingCandidate('first', 'first-after-tally', 1),
        changingCandidate('second', 'second-after-tally', 2),
      ],
      selections: [],
    });

    expect(result.winners).toEqual([]);
  });

  it('uses the final positive-vote candidate as the non-empty seat boundary', () => {
    const result = electionWinnerResolutionTestApi.resolveMultiSeatWinners({
      candidates: [
        { id: 'winner', order_index: 1 },
        { id: 'runner-up', order_index: 2 },
      ],
      selections: [
        { candidate_id: 'winner' },
        { candidate_id: 'winner' },
        { candidate_id: 'runner-up' },
      ],
      seatCount: 1,
    });

    expect(result.requiresRunoff).toBe(false);
    expect(result.winners.map(candidate => candidate.id)).toEqual(['winner']);
  });
});
