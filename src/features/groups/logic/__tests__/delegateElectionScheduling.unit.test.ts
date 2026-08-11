import { describe, expect, it } from 'vitest';
import {
  buildCreateEventSearchFromDelegateElectionAssignment,
  getDelegateElectionSchedulingWindow,
  isEventWithinDelegateElectionSchedulingWindow,
} from '../delegateElectionScheduling';

function assignmentWithTargetStart(startDate: number | null) {
  return {
    targetEvent: {
      id: 'target-event',
      title: 'Target assembly',
      start_date: startDate,
    },
  };
}

function eventAt(startDate: number) {
  return { start_date: startDate };
}

describe('delegateElectionScheduling', () => {
  it('builds a create-event search window from now until before the target event', () => {
    const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();
    const targetStartAt = new Date(2026, 5, 20, 12, 0, 0).getTime();

    expect(
      buildCreateEventSearchFromDelegateElectionAssignment({
        assignment: assignmentWithTargetStart(targetStartAt),
        groupId: 'source-group',
        returnTo: '/group/source-group/memberships?tab=openAssignments',
        referenceTime,
      })
    ).toEqual({
      groupId: 'source-group',
      minStartDate: '2026-06-19',
      minStartTime: '10:31',
      maxStartDate: '2026-06-20',
      maxStartTime: '11:59',
      returnTo: '/group/source-group/memberships?tab=openAssignments',
    });
  });

  it('rejects events before the next input minute after now', () => {
    const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();
    const assignment = assignmentWithTargetStart(new Date(2026, 5, 20, 12, 0, 0).getTime());

    expect(
      isEventWithinDelegateElectionSchedulingWindow(
        eventAt(new Date(2026, 5, 19, 10, 30, 0).getTime()),
        assignment,
        referenceTime
      )
    ).toBe(false);
  });

  it('accepts events before the target event and rejects events at or after the target event', () => {
    const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();
    const targetStartAt = new Date(2026, 5, 20, 12, 0, 0).getTime();
    const assignment = assignmentWithTargetStart(targetStartAt);

    expect(
      isEventWithinDelegateElectionSchedulingWindow(
        eventAt(new Date(2026, 5, 20, 11, 59, 0).getTime()),
        assignment,
        referenceTime
      )
    ).toBe(true);
    expect(
      isEventWithinDelegateElectionSchedulingWindow(
        eventAt(targetStartAt),
        assignment,
        referenceTime
      )
    ).toBe(false);
    expect(
      isEventWithinDelegateElectionSchedulingWindow(
        eventAt(new Date(2026, 5, 20, 12, 1, 0).getTime()),
        assignment,
        referenceTime
      )
    ).toBe(false);
  });

  it('uses the previous local day as max date when the target event starts at midnight', () => {
    const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();
    const targetStartAt = new Date(2026, 5, 20, 0, 0, 0).getTime();

    expect(
      buildCreateEventSearchFromDelegateElectionAssignment({
        assignment: assignmentWithTargetStart(targetStartAt),
        groupId: 'source-group',
        referenceTime,
      })
    ).toMatchObject({
      maxStartDate: '2026-06-19',
      maxStartTime: '23:59',
    });
  });

  it('omits the upper boundary when the target event has no start date', () => {
    const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();

    expect(
      getDelegateElectionSchedulingWindow(assignmentWithTargetStart(null), referenceTime)
    ).toEqual({
      minStartAt: new Date(2026, 5, 19, 10, 31, 0).getTime(),
      maxStartAt: null,
    });

    expect(
      buildCreateEventSearchFromDelegateElectionAssignment({
        assignment: assignmentWithTargetStart(null),
        groupId: 'source-group',
        referenceTime,
      })
    ).toEqual({
      groupId: 'source-group',
      minStartDate: '2026-06-19',
      minStartTime: '10:31',
      maxStartDate: undefined,
      maxStartTime: undefined,
      returnTo: undefined,
    });
  });

  it('rejects events without a start date and accepts an unbounded future event', () => {
    const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();
    const assignment = assignmentWithTargetStart(null);

    expect(isEventWithinDelegateElectionSchedulingWindow({}, assignment, referenceTime)).toBe(
      false
    );
    expect(
      isEventWithinDelegateElectionSchedulingWindow(
        eventAt(new Date(2026, 5, 30, 12, 0, 0).getTime()),
        assignment,
        referenceTime
      )
    ).toBe(true);
  });

  it.each([undefined, 0, Number.NaN, Number.POSITIVE_INFINITY])(
    'treats a non-positive or non-finite target start (%s) as unbounded',
    targetStart => {
      const referenceTime = new Date(2026, 5, 19, 10, 30, 20).getTime();
      const assignment = {
        targetEvent:
          targetStart === undefined
            ? undefined
            : { id: 'target-event', title: 'Target', start_date: targetStart },
      };

      expect(getDelegateElectionSchedulingWindow(assignment, referenceTime).maxStartAt).toBeNull();
    }
  );
});
