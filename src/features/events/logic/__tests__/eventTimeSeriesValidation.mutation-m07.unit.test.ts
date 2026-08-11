import { describe, expect, it } from 'vitest';

import {
  getEventTimeSeriesValidationError,
  hasRequiredEventDateTimeRange,
  isEventTimeSeriesValid,
} from '../eventTimeSeriesValidation';

const completeRange = {
  startDate: '2026-08-10',
  startTime: '09:00',
  endDate: '2026-08-10',
  endTime: '10:00',
};

describe('event time-series mutation boundaries', () => {
  it.each(['startDate', 'startTime', 'endDate', 'endTime'] as const)(
    'rejects a required range when only %s is absent',
    missingPart => {
      const range = { ...completeRange, [missingPart]: '' };

      expect(hasRequiredEventDateTimeRange(range)).toBe(false);
      expect(
        getEventTimeSeriesValidationError({
          ...range,
          recurrencePattern: 'none',
          recurrenceWeekdays: [],
          requireCompleteDateTimeRange: true,
        })
      ).toBe('missing-required-range');
    }
  );

  it('accepts a weekly series with one selected weekday', () => {
    const args = {
      ...completeRange,
      recurrencePattern: 'weekly' as const,
      recurrenceWeekdays: [1],
    };

    expect(getEventTimeSeriesValidationError(args)).toBeNull();
    expect(isEventTimeSeriesValid(args)).toBe(true);
  });

  it('maps a concrete validation error to an invalid result', () => {
    expect(
      isEventTimeSeriesValid({
        ...completeRange,
        recurrencePattern: 'weekly',
        recurrenceWeekdays: [],
      })
    ).toBe(false);
  });
});
