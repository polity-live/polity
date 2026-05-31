import { describe, expect, it } from 'vitest';
import { buildRecurringEventFields } from '@/features/events/logic/buildRecurringEventFields';
import { formatLocalDateInput, formatLocalTimeInput } from '@/features/shared/logic/localDateTime';

describe('buildRecurringEventFields', () => {
  it('clears recurrence fields when recurrence is disabled', () => {
    expect(
      buildRecurringEventFields({
        isRecurring: false,
        recurrence: {
          pattern: 'weekly',
          interval: 1,
          weekdays: [0],
          endDate: '2026-05-26',
        },
      })
    ).toEqual({
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
    });
  });

  it('builds complete recurrence fields for a valid weekly series', () => {
    const result = buildRecurringEventFields({
      isRecurring: true,
      recurrence: {
        pattern: 'weekly',
        interval: 2,
        weekdays: [1, 3],
        endDate: '2026-12-31',
      },
    });

    expect(result.is_recurring).toBe(true);
    expect(result.recurrence_pattern).toBe('weekly');
    expect(result.recurrence_rule).toContain('FREQ=WEEKLY');
    expect(result.recurrence_rule).toContain('INTERVAL=2');
    expect(result.recurrence_days).toEqual([1, 3]);
    expect(formatLocalDateInput(result.recurrence_end_date)).toBe('2026-12-31');
    expect(formatLocalTimeInput(result.recurrence_end_date)).toBe('23:59');
  });

  it('fails closed for invalid weekly series without weekdays', () => {
    expect(
      buildRecurringEventFields({
        isRecurring: true,
        recurrence: {
          pattern: 'weekly',
          interval: 1,
          weekdays: [],
          endDate: '2026-12-31',
        },
      })
    ).toEqual({
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
    });
  });
});
