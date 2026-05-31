import { describe, expect, it } from 'vitest';
import {
  getEventTimeSeriesValidationError,
  hasRequiredEventDateTimeRange,
  isEventTimeSeriesValid,
} from '@/features/events/logic/eventTimeSeriesValidation';

describe('eventTimeSeriesValidation', () => {
  it('requires start and end date/time when the create flow marks them mandatory', () => {
    expect(
      getEventTimeSeriesValidationError({
        startDate: '2026-05-27',
        startTime: '09:00',
        endDate: '',
        endTime: '10:00',
        recurrencePattern: 'none',
        recurrenceWeekdays: [],
        requireCompleteDateTimeRange: true,
      })
    ).toBe('missing-required-range');
  });

  it('does not require a full range unless explicitly requested', () => {
    expect(
      getEventTimeSeriesValidationError({
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        recurrencePattern: 'none',
        recurrenceWeekdays: [],
      })
    ).toBeNull();
  });

  it('keeps weekly recurrence weekday validation after the required range is satisfied', () => {
    expect(
      getEventTimeSeriesValidationError({
        startDate: '2026-05-27',
        startTime: '09:00',
        endDate: '2026-05-27',
        endTime: '10:00',
        recurrencePattern: 'weekly',
        recurrenceWeekdays: [],
        requireCompleteDateTimeRange: true,
      })
    ).toBe('missing-weekdays');
  });

  it('reports a valid create time series once all required fields are present', () => {
    const args = {
      startDate: '2026-05-27',
      startTime: '09:00',
      endDate: '2026-05-27',
      endTime: '10:00',
      recurrencePattern: 'none' as const,
      recurrenceWeekdays: [],
      requireCompleteDateTimeRange: true,
    };

    expect(hasRequiredEventDateTimeRange(args)).toBe(true);
    expect(isEventTimeSeriesValid(args)).toBe(true);
  });
});
