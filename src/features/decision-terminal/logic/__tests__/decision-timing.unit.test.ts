import { describe, expect, it } from 'vitest';

import { getDecisionAgendaRuntimeTimes, resolveDecisionTiming } from '../decision-timing';

const nowMs = new Date('2026-06-19T13:10:00Z').getTime();
const activatedAt = nowMs - 5 * 60_000;
const plannedStart = new Date('2026-06-20T08:00:00Z').getTime();
const plannedEnd = plannedStart + 30 * 60_000;

describe('decision terminal timing', () => {
  it('falls back through updated, created, and fallback timestamps while rejecting invalid dates', () => {
    const fallbackNow = new Date(nowMs);
    expect(
      getDecisionAgendaRuntimeTimes({ updatedAt: '2026-06-19T12:00:00Z', fallbackNow })
    ).toMatchObject({
      startsAt: undefined,
      endsAt: new Date('2026-06-19T12:00:00Z'),
      hasExplicitClosingEnd: false,
    });
    expect(
      getDecisionAgendaRuntimeTimes({
        createdAt: new Date('2026-06-19T11:00:00Z'),
        updatedAt: 'invalid',
        fallbackNow,
      }).endsAt
    ).toEqual(new Date('2026-06-19T11:00:00Z'));
    expect(getDecisionAgendaRuntimeTimes({ createdAt: 'invalid', fallbackNow }).endsAt).toEqual(
      fallbackNow
    );
  });

  it('treats an activated future agenda vote as active', () => {
    const times = getDecisionAgendaRuntimeTimes({
      agendaItem: {
        status: 'in-progress',
        duration: 30,
        activated_at: activatedAt,
        start_time: activatedAt,
        calculated_start_time: plannedStart,
        calculated_end_time: plannedEnd,
      },
      fallbackNow: new Date(nowMs),
    });
    const timing = resolveDecisionTiming({
      phase: 'indication',
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      hasExplicitClosingEnd: times.hasExplicitClosingEnd,
      nowMs,
    });

    expect(times.startsAt?.getTime()).toBe(activatedAt);
    expect(times.endsAt.getTime()).toBe(activatedAt + 30 * 60_000);
    expect(timing.temporalBucket).toBe('active');
    expect(timing.isActiveDecision).toBe(true);
    expect(timing.isFutureDecision).toBe(false);
  });

  it('keeps an unactivated future election in the future bucket', () => {
    const times = getDecisionAgendaRuntimeTimes({
      agendaItem: {
        status: 'planned',
        duration: 30,
        calculated_start_time: plannedStart,
        calculated_end_time: plannedEnd,
      },
      fallbackNow: new Date(nowMs),
    });
    const timing = resolveDecisionTiming({
      phase: 'indication',
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      hasExplicitClosingEnd: times.hasExplicitClosingEnd,
      nowMs,
    });

    expect(times.startsAt?.getTime()).toBe(plannedStart);
    expect(times.endsAt.getTime()).toBe(plannedEnd);
    expect(timing.temporalBucket).toBe('future');
    expect(timing.isActiveDecision).toBe(false);
    expect(timing.isFutureDecision).toBe(true);
  });

  it('uses explicit closing end time before agenda duration', () => {
    const closingEndTime = nowMs + 10 * 60_000;
    const times = getDecisionAgendaRuntimeTimes({
      agendaItem: {
        status: 'in-progress',
        duration: 45,
        activated_at: activatedAt,
        calculated_start_time: plannedStart,
        calculated_end_time: plannedEnd,
      },
      closingEndTime,
      fallbackNow: new Date(nowMs),
    });

    expect(times.endsAt.getTime()).toBe(closingEndTime);
    expect(times.hasExplicitClosingEnd).toBe(true);
  });

  it('classifies closed, explicitly expired, inactive expired, and future decisions', () => {
    const past = new Date(nowMs - 1);
    const future = new Date(nowMs + 1);

    expect(
      resolveDecisionTiming({
        phase: 'closed',
        endsAt: future,
        hasExplicitClosingEnd: false,
        nowMs,
      })
    ).toMatchObject({ isEnded: true, temporalBucket: 'past' });
    expect(
      resolveDecisionTiming({
        phase: 'final',
        endsAt: past,
        hasExplicitClosingEnd: true,
        nowMs,
      })
    ).toMatchObject({ isEnded: true, isActiveDecision: false });
    expect(
      resolveDecisionTiming({
        phase: 'internal',
        endsAt: past,
        hasExplicitClosingEnd: false,
        nowMs,
      })
    ).toMatchObject({ isEnded: true });
    expect(
      resolveDecisionTiming({
        phase: 'internal',
        startsAt: future,
        endsAt: future,
        hasExplicitClosingEnd: false,
        nowMs,
      })
    ).toMatchObject({ isFutureDecision: true, temporalBucket: 'future' });
  });

  it('keeps an active phase without a start or explicit deadline active', () => {
    expect(
      resolveDecisionTiming({
        phase: 'final',
        endsAt: new Date(nowMs - 1),
        hasExplicitClosingEnd: false,
        nowMs,
      })
    ).toMatchObject({ isActiveDecision: true, temporalBucket: 'active' });
  });
});
