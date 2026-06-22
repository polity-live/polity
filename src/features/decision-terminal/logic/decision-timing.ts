import { getAgendaDisplayTimes } from '@/features/agendas/logic/getAgendaDisplayTimes';
import type { VotingPhase } from '@/features/vote-cast/logic/votePhaseHelpers';

export interface DecisionAgendaTimingSource {
  status?: string | null;
  duration?: number | null;
  activated_at?: number | null;
  completed_at?: number | null;
  start_time?: number | null;
  end_time?: number | null;
  calculated_start_time?: number | null;
  calculated_end_time?: number | null;
}

export interface DecisionAgendaRuntimeTimesInput {
  agendaItem?: DecisionAgendaTimingSource | null;
  closingEndTime?: number | null;
  createdAt?: Date | string | number | null;
  updatedAt?: Date | string | number | null;
  fallbackNow?: Date;
}

export interface DecisionAgendaRuntimeTimes {
  startsAt?: Date;
  endsAt: Date;
  sortStartsAt: Date;
  sortEndsAt: Date;
  hasExplicitClosingEnd: boolean;
}

export interface DecisionTimingInput {
  phase: VotingPhase;
  startsAt?: Date;
  endsAt: Date;
  hasExplicitClosingEnd: boolean;
  nowMs?: number;
}

function toDate(value: Date | string | number | null | undefined) {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function isClosedAt(value: Date, nowMs: number) {
  return value.getTime() <= nowMs;
}

export function getDecisionAgendaRuntimeTimes({
  agendaItem,
  closingEndTime,
  createdAt,
  updatedAt,
  fallbackNow = new Date(),
}: DecisionAgendaRuntimeTimesInput): DecisionAgendaRuntimeTimes {
  const hasExplicitClosingEnd = typeof closingEndTime === 'number' && closingEndTime > 0;
  const displayTimes = agendaItem
    ? getAgendaDisplayTimes({
        status: agendaItem.status,
        duration: agendaItem.duration,
        activated_at: agendaItem.activated_at,
        completed_at: agendaItem.completed_at,
        start_time: agendaItem.start_time,
        end_time: agendaItem.end_time,
        calculated_start_time: agendaItem.calculated_start_time,
        calculated_end_time: agendaItem.calculated_end_time,
        closing_end_time: closingEndTime,
      })
    : null;

  const startsAt = toDate(displayTimes?.displayStartTime) ?? toDate(createdAt);
  const endsAt =
    toDate(displayTimes?.displayEndTime) ?? toDate(updatedAt) ?? toDate(createdAt) ?? fallbackNow;

  return {
    startsAt,
    endsAt,
    sortStartsAt: startsAt ?? endsAt,
    sortEndsAt: endsAt,
    hasExplicitClosingEnd,
  };
}

export function resolveDecisionTiming({
  phase,
  startsAt,
  endsAt,
  hasExplicitClosingEnd,
  nowMs = Date.now(),
}: DecisionTimingInput) {
  const startsInFuture = startsAt ? startsAt.getTime() > nowMs : false;
  const isActiveByStatus = phase === 'indication' || phase === 'final';
  const closedByStatus = phase === 'closed';
  const isEnded =
    closedByStatus ||
    (hasExplicitClosingEnd && isClosedAt(endsAt, nowMs)) ||
    (!isActiveByStatus && isClosedAt(endsAt, nowMs));
  const isActiveDecision = isActiveByStatus && !isEnded && !startsInFuture;
  const isFutureDecision = !isEnded && !isActiveDecision;

  return {
    isActiveDecision,
    isFutureDecision,
    isEnded,
    temporalBucket: isEnded
      ? ('past' as const)
      : isActiveDecision
        ? ('active' as const)
        : ('future' as const),
  };
}
