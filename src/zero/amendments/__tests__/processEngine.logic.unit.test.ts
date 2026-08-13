import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import {
  addCalendarOffset,
  buildTallyByChoiceId,
  compareStepRunsByProcessOrder,
  computeConfirmedAgendaTailOrderIndex,
  deriveProcessRunState,
  getBranchStartGroupIdFromStepRuns,
  getEventOrderingAnchor,
  getEvaluationTargetGroupId,
  getForwardedEventEditingMode,
  getStepDecisionStatus,
  getStepRunFingerprint,
  isAcceptDecisionChoice,
  isRejectDecisionChoice,
  isTerminalBranchStatus,
  isTerminalStepStatus,
  normalizeMajorityType,
  resolveConcreteEvaluationDate,
  resolveDecisionVoteOutcome,
  resolveReplannedStepSchedule,
} from '../process-engine-logic';

describe('process-engine pure business rules', () => {
  it('classifies every terminal and non-terminal process status', () => {
    for (const status of ['approved', 'rejected', 'merged', 'withdrawn', 'completed']) {
      expect(isTerminalStepStatus(status)).toBe(true);
    }
    for (const status of ['pending_event', 'scheduled', 'in_vote', null, undefined]) {
      expect(isTerminalStepStatus(status)).toBe(false);
    }

    for (const status of ['completed', 'rejected', 'withdrawn', 'merged']) {
      expect(isTerminalBranchStatus(status)).toBe(true);
    }
    for (const status of ['pending_event', 'scheduled', 'in_vote', null, undefined]) {
      expect(isTerminalBranchStatus(status)).toBe(false);
    }
  });

  it.each([
    ['absolute', 'absolute'],
    ['two_thirds', 'two_thirds'],
    ['simple', 'simple'],
    ['unsupported', 'simple'],
    [null, 'simple'],
  ])('normalizes majority type %s to %s', (input, expected) => {
    expect(normalizeMajorityType(input)).toBe(expected);
  });

  it('recognizes semantic decision labels independently of case and whitespace', () => {
    for (const label of ['accept', ' Accept ', 'yes', 'YES']) {
      expect(isAcceptDecisionChoice(label)).toBe(true);
      expect(isRejectDecisionChoice(label)).toBe(false);
    }
    for (const label of ['reject', ' Reject ', 'no', 'NO']) {
      expect(isRejectDecisionChoice(label)).toBe(true);
      expect(isAcceptDecisionChoice(label)).toBe(false);
    }
    expect(isAcceptDecisionChoice(null)).toBe(false);
    expect(isRejectDecisionChoice(undefined)).toBe(false);
  });

  it('uses an event end, then its start, then no ordering anchor', () => {
    expect(getEventOrderingAnchor({ eventStartDate: 10, eventEndDate: 20 })).toBe(20);
    expect(getEventOrderingAnchor({ eventStartDate: 10, eventEndDate: null })).toBe(10);
    expect(getEventOrderingAnchor({ eventStartDate: null, eventEndDate: null })).toBeNull();
  });

  it('builds stable fingerprints for workflow, automatic merge, and runtime steps', () => {
    const base = {
      process_run_id: 'run-1',
      workflow_step_id: null,
      target_group_id: 'group-1',
      event_id: 'event-1',
      order_index: 3,
      step_kind: 'merge_vote',
    };
    expect(getStepRunFingerprint({ ...base, workflow_step_id: 'workflow-step-1' })).toBe(
      'workflow:workflow-step-1'
    );
    expect(getStepRunFingerprint(base)).toBe('auto-merge:run-1:group-1:event-1');
    expect(getStepRunFingerprint({ ...base, event_id: null })).toBe(
      'runtime:run-1:group-1:3:merge_vote'
    );
    expect(getStepRunFingerprint({ ...base, target_group_id: null })).toBe(
      'runtime:run-1:none:3:merge_vote'
    );
    expect(getStepRunFingerprint({ ...base, step_kind: 'group_vote' })).toBe(
      'runtime:run-1:group-1:3:group_vote'
    );
  });

  it('orders steps by process position and uses the id as deterministic tie-breaker', () => {
    expect(
      compareStepRunsByProcessOrder({ id: 'b', order_index: 1 }, { id: 'a', order_index: 2 })
    ).toBeLessThan(0);
    expect(
      compareStepRunsByProcessOrder({ id: 'b', order_index: 2 }, { id: 'a', order_index: 1 })
    ).toBeGreaterThan(0);
    expect(
      compareStepRunsByProcessOrder({ id: 'a', order_index: 1 }, { id: 'b', order_index: 1 })
    ).toBeLessThan(0);
    expect(
      compareStepRunsByProcessOrder({ id: 'a', order_index: 1 }, { id: 'a', order_index: 1 })
    ).toBe(0);
  });

  it('derives the first branch group after sorting its steps', () => {
    expect(getBranchStartGroupIdFromStepRuns([])).toBeNull();
    expect(
      getBranchStartGroupIdFromStepRuns([
        { order_index: 2, target_group_id: 'later' },
        { order_index: 1, target_group_id: 'target', source_group_id: 'source' },
      ])
    ).toBe('target');
    expect(
      getBranchStartGroupIdFromStepRuns([
        { order_index: 1, target_group_id: null, source_group_id: 'source' },
      ])
    ).toBe('source');
    expect(
      getBranchStartGroupIdFromStepRuns([
        { order_index: 1, target_group_id: null, source_group_id: null },
      ])
    ).toBeNull();
  });

  it('finds the tail of only confirmed agenda items', () => {
    const items = [
      { id: 'first', order_index: 2, forwarding_status: 'forward_confirmed' },
      { id: 'excluded', order_index: 10, forwarding_status: 'forward_confirmed' },
      { id: 'outstanding', order_index: 999, forwarding_status: 'previous_decision_outstanding' },
      { id: 'without-order', order_index: null, forwarding_status: null },
    ];
    expect(computeConfirmedAgendaTailOrderIndex(items)).toBe(10);
    expect(computeConfirmedAgendaTailOrderIndex(items, 'excluded')).toBe(2);
    expect(computeConfirmedAgendaTailOrderIndex([], null)).toBe(0);
  });

  it.each([
    ['approved', null, 'approved', null],
    ['completed', null, 'approved', null],
    ['rejected', null, 'rejected', null],
    ['merged', null, 'merged', null],
    ['withdrawn', null, 'withdrawn', null],
    ['scheduled', 'tie', 'tie', null],
    ['scheduled', null, 'forward_confirmed', 'step-1'],
    ['scheduled', null, 'previous_decision_outstanding', 'other'],
  ])('derives %s/%s as %s', (status, decisionStatus, expected, firstUnresolvedStepId) => {
    expect(
      getStepDecisionStatus(
        { id: 'step-1', status, decision_status: decisionStatus },
        firstUnresolvedStepId
      )
    ).toBe(expected);
  });

  it.each([
    [[{ id: 'vote', status: 'in_vote' }], 'in_vote', 'vote'],
    [[{ id: 'scheduled', status: 'scheduled' }], 'scheduled', 'scheduled'],
    [[{ id: 'pending', status: 'pending_event' }], 'pending_event', 'pending'],
    [[{ id: 'rejected', status: 'rejected' }], 'rejected', null],
    [[{ id: 'completed', status: 'completed' }], 'completed', null],
    [[], 'completed', null],
  ])('derives process state %j as %s', (branches, status, activeBranchId) => {
    expect(deriveProcessRunState(branches)).toEqual({ status, activeBranchId });
  });

  it('selects editing mode from the presence of a forwarded event', () => {
    expect(getForwardedEventEditingMode('event-1')).toBe('suggest_event');
    expect(getForwardedEventEditingMode(null)).toBe('view');
    expect(getForwardedEventEditingMode(undefined)).toBe('view');
  });

  it('selects the configured, step, or absent evaluation target group', () => {
    expect(getEvaluationTargetGroupId('configured', 'step')).toBe('configured');
    expect(getEvaluationTargetGroupId(null, 'step')).toBe('step');
    expect(getEvaluationTargetGroupId(undefined, null)).toBeNull();
  });

  it('adds calendar offsets and clamps dates to the target month', () => {
    const january31 = new Date(2024, 0, 31, 12, 0, 0, 0).getTime();
    expect(addCalendarOffset({ timestamp: january31 })).toBe(january31);
    expect(new Date(addCalendarOffset({ timestamp: january31, months: 1 })).getDate()).toBe(29);
    expect(addCalendarOffset({ timestamp: january31, months: 2, years: 1 })).toBe(
      new Date(2025, 2, 31, 12, 0, 0, 0).getTime()
    );
  });

  it('resolves fixed, relative, and disabled implementation evaluation dates', () => {
    const timestamp = new Date(2024, 0, 31, 12, 0, 0, 0).getTime();
    expect(
      resolveConcreteEvaluationDate({
        evaluationMode: 'fixed_date',
        evaluationDate: 123,
        decisionTimestamp: timestamp,
      })
    ).toBe(123);
    expect(
      resolveConcreteEvaluationDate({
        evaluationMode: 'fixed_date',
        evaluationDate: null,
        decisionTimestamp: timestamp,
      })
    ).toBeNull();
    expect(
      resolveConcreteEvaluationDate({
        evaluationMode: 'relative_to_vote',
        decisionTimestamp: timestamp,
      })
    ).toBe(timestamp);
    expect(
      resolveConcreteEvaluationDate({
        evaluationMode: 'relative_to_vote',
        evaluationOffsetMonths: 1,
        evaluationOffsetYears: 1,
        decisionTimestamp: timestamp,
      })
    ).toBe(new Date(2025, 1, 28, 12, 0, 0, 0).getTime());
    expect(
      resolveConcreteEvaluationDate({ evaluationMode: null, decisionTimestamp: timestamp })
    ).toBeNull();
  });

  it('resolves replanned, cleared, retained, and unavailable event schedules', () => {
    const events = new Map([
      ['event-complete', { start_date: 20, end_date: 30 }],
      ['event-no-end', { start_date: 40, end_date: null }],
    ]);

    expect(
      resolveReplannedStepSchedule(
        { id: 'step-1', event_id: 'event-old', starts_at: 10 },
        new Map([['step-1', 'event-complete']]),
        events
      )
    ).toMatchObject({ eventId: 'event-complete', eventStartDate: 20, eventEndDate: 30 });
    expect(
      resolveReplannedStepSchedule(
        { id: 'step-2', event_id: 'event-old', starts_at: 10 },
        new Map([['step-2', 'event-no-end']]),
        events
      )
    ).toMatchObject({ eventStartDate: 40, eventEndDate: 40 });
    expect(
      resolveReplannedStepSchedule(
        { id: 'step-3', event_id: 'event-old', starts_at: 10 },
        new Map(),
        new Map()
      )
    ).toMatchObject({ eventId: 'event-old', eventStartDate: 10, eventEndDate: 10 });
    expect(
      resolveReplannedStepSchedule({ id: 'step-4', event_id: 'event-old' }, new Map(), new Map())
    ).toMatchObject({ eventStartDate: null, eventEndDate: null });
    expect(
      resolveReplannedStepSchedule(
        { id: 'step-5', event_id: 'event-old', starts_at: 10 },
        new Map([['step-5', null]]),
        events
      )
    ).toMatchObject({ eventId: null, eventStartDate: null, eventEndDate: null });
    expect(
      resolveReplannedStepSchedule(
        { id: 'step-6', event_id: null, starts_at: 10 },
        new Map(),
        events
      )
    ).toMatchObject({ eventId: null, eventStartDate: 10, eventEndDate: 10 });
  });

  it('builds final tallies from online and offline decisions only', () => {
    expect(buildTallyByChoiceId({})).toEqual(new Map());
    expect(
      buildTallyByChoiceId({
        choices: [{ id: 'accept' }, { id: 'reject' }],
        final_decisions: [{ choice_id: 'accept' }, { choice_id: 'choice-created-by-decision' }],
        offline_tallies: [
          { choice_id: 'reject', phase: 'indicative', count: 100 },
          { choice_id: 'reject', phase: 'final', count: 2 },
          { choice_id: 'choice-created-offline', phase: 'final', count: 3 },
        ],
      })
    ).toEqual(
      new Map([
        ['accept', 1],
        ['reject', 2],
        ['choice-created-by-decision', 1],
        ['choice-created-offline', 3],
      ])
    );
  });

  it('resolves semantic, positional, empty, and majority-based decision votes', () => {
    expect(resolveDecisionVoteOutcome({})).toMatchObject({
      result: 'tie',
      totalEligible: 0,
    });
    expect(
      resolveDecisionVoteOutcome({
        majority_type: 'absolute',
        choices: [
          { id: 'reject', label: 'unknown', order_index: null },
          { id: 'accept', label: 'another', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'reject' },
          { choice_id: 'reject' },
          { choice_id: 'accept' },
        ],
        voters: [{}, {}, {}, {}],
      })
    ).toMatchObject({ result: 'rejected', totalEligible: 4 });
    expect(
      resolveDecisionVoteOutcome({
        majority_type: 'two_thirds',
        choices: [
          { id: 'no', label: 'no', order_index: 2 },
          { id: 'yes', label: 'yes', order_index: 1 },
        ],
        final_decisions: [{ choice_id: 'yes' }],
        final_participations: [{}],
        offline_tallies: [{ choice_id: 'yes', phase: 'final', count: 1 }],
      })
    ).toMatchObject({ result: 'passed', totalEligible: 2 });
    expect(
      resolveDecisionVoteOutcome({
        choices: [
          { id: 'accept', label: 'accept', order_index: null },
          { id: 'reject', label: 'reject', order_index: null },
        ],
      })
    ).toMatchObject({ result: 'tie', totalEligible: 0 });
  });
});

test.prop([
  fc.record({ id: fc.string(), order_index: fc.integer() }),
  fc.record({ id: fc.string(), order_index: fc.integer() }),
])('step ordering is antisymmetric', (left, right) => {
  const forward = Math.sign(compareStepRunsByProcessOrder(left, right));
  const backward = Math.sign(compareStepRunsByProcessOrder(right, left));
  expect(forward).toBe(-backward);
});
