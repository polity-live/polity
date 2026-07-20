import type { RecurrencePattern } from './rruleHelpers';

export type EventTimeSeriesValidationError =
  'missing-required-range' | 'missing-start-date' | 'missing-weekdays' | null;

interface EventTimeSeriesValidationArgs {
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  recurrencePattern: RecurrencePattern;
  recurrenceWeekdays: number[];
  requireCompleteDateTimeRange?: boolean;
}

export function hasRequiredEventDateTimeRange({
  startDate,
  startTime,
  endDate,
  endTime,
}: Pick<EventTimeSeriesValidationArgs, 'startDate' | 'startTime' | 'endDate' | 'endTime'>) {
  return Boolean(startDate && startTime && endDate && endTime);
}

export function getEventTimeSeriesValidationError({
  startDate,
  startTime,
  endDate,
  endTime,
  recurrencePattern,
  recurrenceWeekdays,
  requireCompleteDateTimeRange = false,
}: EventTimeSeriesValidationArgs): EventTimeSeriesValidationError {
  if (
    requireCompleteDateTimeRange &&
    !hasRequiredEventDateTimeRange({
      startDate,
      startTime,
      endDate,
      endTime,
    })
  ) {
    return 'missing-required-range';
  }

  if (recurrencePattern !== 'none' && !startDate) {
    return 'missing-start-date';
  }

  if (recurrencePattern === 'weekly' && recurrenceWeekdays.length === 0) {
    return 'missing-weekdays';
  }

  return null;
}

export function isEventTimeSeriesValid(args: EventTimeSeriesValidationArgs): boolean {
  return getEventTimeSeriesValidationError(args) === null;
}
