interface AgendaDisplayTimesInput {
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

  return {
    actualStartTime,
    actualEndTime,
    displayStartTime: actualStartTime ?? input.calculated_start_time ?? undefined,
    displayEndTime: actualEndTime ?? input.calculated_end_time ?? undefined,
  };
}
