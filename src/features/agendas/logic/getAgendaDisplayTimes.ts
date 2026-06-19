const DEFAULT_AGENDA_DURATION_MINUTES = 30;

export interface AgendaDisplayTimesInput {
  status?: string | null;
  duration?: number | null;
  closing_end_time?: number | null;
  activated_at?: number | null;
  completed_at?: number | null;
  start_time?: number | null;
  end_time?: number | null;
  calculated_start_time?: number | null;
  calculated_end_time?: number | null;
}

function hasTimestamp(value: number | null | undefined): value is number {
  return typeof value === 'number' && value > 0;
}

function getDurationMinutes(value: number | null | undefined) {
  return typeof value === 'number' && value > 0 ? value : DEFAULT_AGENDA_DURATION_MINUTES;
}

export function getAgendaDisplayTimes(input: AgendaDisplayTimesInput) {
  const actualStartTime = hasTimestamp(input.activated_at)
    ? input.activated_at
    : hasTimestamp(input.start_time)
      ? input.start_time
      : undefined;

  const actualEndTime = hasTimestamp(input.completed_at)
    ? input.completed_at
    : hasTimestamp(input.end_time)
      ? input.end_time
      : undefined;
  const explicitClosingEndTime = hasTimestamp(input.closing_end_time)
    ? input.closing_end_time
    : undefined;
  const effectiveStartTime = actualStartTime ?? input.calculated_start_time ?? undefined;
  const isCompleted =
    input.status === 'completed' ||
    hasTimestamp(input.completed_at) ||
    hasTimestamp(input.end_time);
  const isOngoing =
    !isCompleted &&
    (input.status === 'in-progress' ||
      input.status === 'active' ||
      hasTimestamp(input.activated_at) ||
      hasTimestamp(input.start_time));
  const expectedEndTime =
    !isCompleted && isOngoing
      ? (explicitClosingEndTime ??
        (effectiveStartTime
          ? effectiveStartTime + getDurationMinutes(input.duration) * 60_000
          : undefined))
      : undefined;

  return {
    actualStartTime,
    actualEndTime,
    expectedEndTime,
    displayStartTime: effectiveStartTime,
    displayEndTime:
      actualEndTime ??
      expectedEndTime ??
      explicitClosingEndTime ??
      input.calculated_end_time ??
      undefined,
  };
}
