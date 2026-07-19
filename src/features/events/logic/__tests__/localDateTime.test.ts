import { describe, expect, it } from 'vitest';
import {
  formatLocalDateInput,
  formatDateInputInTimeZone,
  formatLocalDateTimeInput,
  formatLocalTimeInput,
  formatOptionalLocalTimeInput,
  parseLocalDateInput,
  toLocalDeadlineTimestamp,
  toLocalDateTimeTimestamp,
  toLocalEndOfDayTimestamp,
  toLocalTimestamp,
  toTimestampInTimeZone,
} from '@/features/shared/logic/localDateTime';

describe('localDateTime helpers', () => {
  it('roundtrips local date and time inputs without shifting them', () => {
    const timestamp = toLocalTimestamp('2026-05-26', '09:45');

    expect(timestamp).not.toBeNull();
    expect(formatLocalDateInput(timestamp)).toBe('2026-05-26');
    expect(formatLocalTimeInput(timestamp)).toBe('09:45');
  });

  it('roundtrips datetime-local inputs without UTC drift', () => {
    const timestamp = toLocalDateTimeTimestamp('2026-10-05T17:30');

    expect(timestamp).not.toBeNull();
    expect(formatLocalDateTimeInput(timestamp)).toBe('2026-10-05T17:30');
  });

  it('stores recurrence end dates at the end of the selected local day', () => {
    const timestamp = toLocalEndOfDayTimestamp('2026-12-24');

    expect(timestamp).not.toBeNull();
    expect(formatLocalDateInput(timestamp)).toBe('2026-12-24');
    expect(formatLocalTimeInput(timestamp)).toBe('23:59');
  });

  it('parses date inputs into stable local dates', () => {
    const parsed = parseLocalDateInput('2026-08-14');

    expect(parsed).toBeDefined();
    expect(formatLocalDateInput(parsed)).toBe('2026-08-14');
  });

  it('treats legacy zero timestamps as empty values', () => {
    expect(formatLocalDateInput(0)).toBe('');
    expect(formatLocalTimeInput(0)).toBe('');
    expect(formatLocalDateTimeInput(0)).toBe('');
  });

  it('uses local end of day when a deadline has no explicit time', () => {
    const timestamp = toLocalDeadlineTimestamp('2026-07-19');

    expect(timestamp).not.toBeNull();
    expect(formatLocalDateInput(timestamp)).toBe('2026-07-19');
    expect(formatOptionalLocalTimeInput(timestamp)).toBe('');
  });

  it('preserves an explicit deadline minute', () => {
    const timestamp = toLocalDeadlineTimestamp('2026-07-19', '14:30');

    expect(timestamp).not.toBeNull();
    expect(formatLocalDateInput(timestamp)).toBe('2026-07-19');
    expect(formatOptionalLocalTimeInput(timestamp)).toBe('14:30');
  });

  it('resolves date-only deadlines in Europe/Berlin and America/New_York', () => {
    const berlin = toTimestampInTimeZone('2026-07-19', 'Europe/Berlin', {
      dateOnlyBoundary: 'end',
    });
    const newYork = toTimestampInTimeZone('2026-07-19', 'America/New_York', {
      dateOnlyBoundary: 'end',
    });

    expect(new Date(berlin ?? 0).toISOString()).toBe('2026-07-19T21:59:59.999Z');
    expect(new Date(newYork ?? 0).toISOString()).toBe('2026-07-20T03:59:59.999Z');
  });

  it('resolves naive local times across a daylight-saving boundary', () => {
    const timestamp = toTimestampInTimeZone('2026-03-29T03:30', 'Europe/Berlin');

    expect(new Date(timestamp ?? 0).toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('keeps offset-bearing timestamps absolute', () => {
    const timestamp = toTimestampInTimeZone('2026-07-19T14:30:00+02:00', 'America/New_York');

    expect(new Date(timestamp ?? 0).toISOString()).toBe('2026-07-19T12:30:00.000Z');
  });

  it('formats the current calendar date in the requested IANA time zone', () => {
    const instant = '2026-07-19T01:00:00.000Z';

    expect(formatDateInputInTimeZone(instant, 'Europe/Berlin')).toBe('2026-07-19');
    expect(formatDateInputInTimeZone(instant, 'America/New_York')).toBe('2026-07-18');
  });
});
