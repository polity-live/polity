import { describe, expect, it } from 'vitest';
import {
  formatLocalDateInput,
  formatLocalDateTimeInput,
  formatLocalTimeInput,
  parseLocalDateInput,
  toLocalDateTimeTimestamp,
  toLocalEndOfDayTimestamp,
  toLocalTimestamp,
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
});
