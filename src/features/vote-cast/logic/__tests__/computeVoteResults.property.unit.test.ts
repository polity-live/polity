import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';

import { computeVoteResult, tallyFinalChoiceResults } from '../computeVoteResults';

test.prop([fc.nat({ max: 10_000 }), fc.nat({ max: 10_000 })])(
  'simple majority is symmetric around a tie',
  (accept, reject) => {
    const result = computeVoteResult(accept, reject, accept + reject, 'simple');
    expect(result).toBe(accept === reject ? 'tie' : accept > reject ? 'passed' : 'rejected');
  }
);

test.prop([fc.nat({ max: 10_000 }), fc.nat({ max: 10_000 }), fc.nat({ max: 20_000 })])(
  'absolute majority only passes above half of the electorate',
  (accept, reject, eligible) => {
    const result = computeVoteResult(accept, reject, eligible, 'absolute');
    if (accept === reject) expect(result).toBe('tie');
    else expect(result === 'passed').toBe(accept > eligible / 2);
  }
);

test.prop([fc.nat({ max: 10_000 }), fc.nat({ max: 10_000 }), fc.nat({ max: 20_000 })])(
  'two-thirds majority only passes at its inclusive threshold',
  (accept, reject, eligible) => {
    const result = computeVoteResult(accept, reject, eligible, 'two_thirds');
    if (accept === reject) expect(result).toBe('tie');
    else expect(result === 'passed').toBe(accept >= (eligible * 2) / 3);
  }
);

test.prop([
  fc.array(fc.constantFrom('accept', 'reject', 'abstain'), { maxLength: 500 }),
  fc.record({
    accept: fc.nat({ max: 500 }),
    reject: fc.nat({ max: 500 }),
    abstain: fc.nat({ max: 500 }),
  }),
])('online and final offline tallies conserve every generated ballot', (decisions, offline) => {
  const choices = [
    { id: 'accept', label: 'Accept', order_index: 0 },
    { id: 'reject', label: 'Reject', order_index: 1 },
    { id: 'abstain', label: 'Abstain', order_index: 2 },
  ];
  const tallies = tallyFinalChoiceResults(
    choices,
    decisions.map(choice_id => ({ choice_id })),
    Object.entries(offline).map(([choice_id, count]) => ({
      choice_id,
      count,
      phase: 'final',
    }))
  );

  expect(tallies.reduce((sum, tally) => sum + tally.count, 0)).toBe(
    decisions.length + offline.accept + offline.reject + offline.abstain
  );
  expect(tallies.every(tally => tally.percent >= 0 && tally.percent <= 100)).toBe(true);
});
