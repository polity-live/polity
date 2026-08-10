import { describe, expect, it } from 'vitest';

import {
  computeVoteResult,
  computeVoteResultSummary,
  tallyFinalChoiceResults,
  type ChoiceInfo,
  type MajorityType,
} from '../computeVoteResults';

const YES_NO_CHOICES = [
  { id: 'yes', label: 'Yes', order_index: 0 },
  { id: 'no', label: 'No', order_index: 1 },
  { id: 'abstain', label: 'Abstain', order_index: 2 },
] as const;

describe('computeVoteResults mutation decision table', () => {
  it('initializes every choice and defaults the optional offline collection', () => {
    expect(tallyFinalChoiceResults(YES_NO_CHOICES, [])).toEqual([
      { choiceId: 'yes', label: 'Yes', count: 0, percent: 0 },
      { choiceId: 'no', label: 'No', count: 0, percent: 0 },
      { choiceId: 'abstain', label: 'Abstain', count: 0, percent: 0 },
    ]);
  });

  it('counts known and unknown online choices without changing the declared result order', () => {
    expect(
      tallyFinalChoiceResults(
        [YES_NO_CHOICES[1], YES_NO_CHOICES[0], YES_NO_CHOICES[2]],
        [{ choice_id: 'yes' }, { choice_id: 'yes' }, { choice_id: 'no' }, { choice_id: 'unknown' }]
      )
    ).toEqual([
      { choiceId: 'no', label: 'No', count: 1, percent: 25 },
      { choiceId: 'yes', label: 'Yes', count: 2, percent: 50 },
      { choiceId: 'abstain', label: 'Abstain', count: 0, percent: 0 },
    ]);
  });

  it('adds only final offline tallies with a concrete choice and defaults a null count', () => {
    expect(
      tallyFinalChoiceResults(
        YES_NO_CHOICES,
        [],
        [
          { phase: 'indicative', choice_id: 'yes', count: 40 },
          { phase: 'final', choice_id: null, count: 30 },
          { phase: 'final', choice_id: 'yes', count: null },
          { phase: 'final', choice_id: 'yes', count: 1 },
          { phase: 'final', choice_id: 'no', count: 2 },
        ]
      )
    ).toEqual([
      { choiceId: 'yes', label: 'Yes', count: 1, percent: 33 },
      { choiceId: 'no', label: 'No', count: 2, percent: 67 },
      { choiceId: 'abstain', label: 'Abstain', count: 0, percent: 0 },
    ]);
  });

  it.each([
    { majority: 'simple', accept: 4, reject: 4, eligible: 10, result: 'tie' },
    { majority: 'simple', accept: 5, reject: 4, eligible: 20, result: 'passed' },
    { majority: 'simple', accept: 4, reject: 5, eligible: 5, result: 'rejected' },
    { majority: 'absolute', accept: 5, reject: 5, eligible: 10, result: 'tie' },
    { majority: 'absolute', accept: 5, reject: 1, eligible: 10, result: 'rejected' },
    { majority: 'absolute', accept: 6, reject: 1, eligible: 10, result: 'passed' },
    { majority: 'two_thirds', accept: 6, reject: 6, eligible: 9, result: 'tie' },
    { majority: 'two_thirds', accept: 5, reject: 1, eligible: 9, result: 'rejected' },
    { majority: 'two_thirds', accept: 6, reject: 1, eligible: 9, result: 'passed' },
  ] as const)(
    'returns $result for $majority with $accept/$reject of $eligible eligible',
    ({ majority, accept, reject, eligible, result }) => {
      expect(computeVoteResult(accept, reject, eligible, majority)).toBe(result);
    }
  );

  it('keeps the runtime fallback equivalent to a simple majority', () => {
    expect(computeVoteResult(2, 1, 100, 'legacy' as MajorityType)).toBe('passed');
    expect(computeVoteResult(1, 2, 1, 'legacy' as MajorityType)).toBe('rejected');
  });

  it.each([
    { acceptLabel: '  YES  ', rejectLabel: '  NO  ' },
    { acceptLabel: '  AcCePt ', rejectLabel: ' ReJeCt  ' },
  ])('normalizes decisive labels $acceptLabel and $rejectLabel', ({ acceptLabel, rejectLabel }) => {
    const summary = computeVoteResultSummary(
      [
        { id: 'reject', label: rejectLabel, order_index: 0 },
        { id: 'accept', label: acceptLabel, order_index: 2 },
      ],
      [{ choice_id: 'accept' }],
      3,
      'simple'
    );

    expect(summary).toEqual({
      result: 'passed',
      choiceTallies: [
        { choiceId: 'reject', label: rejectLabel, count: 0, percent: 0 },
        { choiceId: 'accept', label: acceptLabel, count: 1, percent: 100 },
      ],
      totalEligible: 3,
      totalVoted: 1,
      winningChoiceId: 'accept',
      winningLabel: acceptLabel,
      winningPercent: 100,
      majorityType: 'simple',
    });
  });

  it('sorts non-semantic legacy choices before selecting accept and reject fallbacks', () => {
    const summary = computeVoteResultSummary(
      [
        { id: 'later', label: 'Later option', order_index: 9 },
        { id: 'reject-fallback', label: 'Second option', order_index: 2 },
        { id: 'accept-fallback', label: 'First option', order_index: 1 },
      ],
      [{ choice_id: 'accept-fallback' }, { choice_id: 'accept-fallback' }],
      3,
      'simple'
    );

    expect(summary.result).toBe('passed');
    expect(summary.winningChoiceId).toBe('accept-fallback');
    expect(summary.winningLabel).toBe('First option');
    expect(summary.winningPercent).toBe(100);
  });

  it('does not report a winner for a tie', () => {
    expect(
      computeVoteResultSummary(
        YES_NO_CHOICES,
        [{ choice_id: 'yes' }, { choice_id: 'no' }],
        2,
        'simple'
      )
    ).toEqual({
      result: 'tie',
      choiceTallies: [
        { choiceId: 'yes', label: 'Yes', count: 1, percent: 50 },
        { choiceId: 'no', label: 'No', count: 1, percent: 50 },
        { choiceId: 'abstain', label: 'Abstain', count: 0, percent: 0 },
      ],
      totalEligible: 2,
      totalVoted: 2,
      winningChoiceId: null,
      winningLabel: null,
      winningPercent: null,
      majorityType: 'simple',
    });
  });

  it('uses semantic decisive choices even when their order would select different fallbacks', () => {
    const choices: ChoiceInfo[] = [
      { id: 'other-a', label: 'Alpha', order_index: 0 },
      { id: 'other-b', label: 'Beta', order_index: 1 },
      { id: 'no', label: 'No', order_index: 8 },
      { id: 'yes', label: 'Yes', order_index: 9 },
    ];
    const summary = computeVoteResultSummary(
      choices,
      [{ choice_id: 'yes' }, { choice_id: 'no' }, { choice_id: 'no' }],
      3,
      'simple'
    );

    expect(summary.result).toBe('rejected');
    expect(summary.totalVoted).toBe(3);
    expect(summary.winningChoiceId).toBe('no');
    expect(summary.winningLabel).toBe('No');
    expect(summary.winningPercent).toBe(67);
  });

  it('defaults a decisive count when a mutable integration choice disappears from its tally', () => {
    let idReads = 0;
    const mutableAccept: ChoiceInfo = {
      get id() {
        idReads += 1;
        return idReads <= 2 ? 'yes' : `changed-${idReads}`;
      },
      label: 'Yes',
      order_index: 0,
    };

    expect(
      computeVoteResultSummary(
        [mutableAccept, { id: 'no', label: 'No', order_index: 1 }],
        [],
        2,
        'simple'
      ).result
    ).toBe('tie');
  });
});
