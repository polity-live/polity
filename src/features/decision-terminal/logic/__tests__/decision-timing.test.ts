import { describe, expect, it } from 'vitest';

import { getDecisionAgendaRuntimeTimes, resolveDecisionTiming } from '../decision-timing';

const nowMs = new Date('2026-06-19T13:10:00Z').getTime();
const activatedAt = nowMs - 5 * 60_000;
const plannedStart = new Date('2026-06-20T08:00:00Z').getTime();
const plannedEnd = plannedStart + 30 * 60_000;

describe('decision terminal timing', () => {
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
});
