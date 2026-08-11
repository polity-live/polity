import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';

import {
  getEventTimeSeriesValidationError,
  hasRequiredEventDateTimeRange,
  isEventTimeSeriesValid,
} from '../eventTimeSeriesValidation';

const optionalPart = fc.constantFrom('', '2026-08-01', '10:00');

test.prop([optionalPart, optionalPart, optionalPart, optionalPart])(
  'a required date-time range is valid exactly when all four parts exist',
  (startDate, startTime, endDate, endTime) => {
    const complete = Boolean(startDate && startTime && endDate && endTime);
    expect(hasRequiredEventDateTimeRange({ startDate, startTime, endDate, endTime })).toBe(
      complete
    );
    expect(
      getEventTimeSeriesValidationError({
        startDate,
        startTime,
        endDate,
        endTime,
        recurrencePattern: 'none',
        recurrenceWeekdays: [],
        requireCompleteDateTimeRange: true,
      })
    ).toBe(complete ? null : 'missing-required-range');
  }
);

test.prop([fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 20 })])(
  'weekly recurrence requires at least one weekday',
  weekdays => {
    const args = {
      startDate: '2026-08-01',
      startTime: '10:00',
      endDate: '2026-08-01',
      endTime: '11:00',
      recurrencePattern: 'weekly' as const,
      recurrenceWeekdays: weekdays,
    };
    expect(getEventTimeSeriesValidationError(args)).toBe(
      weekdays.length ? null : 'missing-weekdays'
    );
    expect(isEventTimeSeriesValid(args)).toBe(weekdays.length > 0);
  }
);
