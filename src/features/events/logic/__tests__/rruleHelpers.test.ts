import { describe, expect, it } from 'vitest';
import {
  buildRRule,
  parseRRuleToFormState,
  type RecurrenceFormState,
} from '@/features/events/logic/rruleHelpers';

describe('rruleHelpers', () => {
  const cases: RecurrenceFormState[] = [
    {
      pattern: 'daily',
      interval: 2,
      weekdays: [],
      endDate: '2026-05-26',
    },
    {
      pattern: 'weekly',
      interval: 1,
      weekdays: [0, 2, 4],
      endDate: '2026-06-30',
    },
    {
      pattern: 'monthly',
      interval: 3,
      weekdays: [],
      endDate: '2026-09-01',
    },
    {
      pattern: 'yearly',
      interval: 2,
      weekdays: [],
      endDate: '2027-01-15',
    },
    {
      pattern: 'four-yearly',
      interval: 2,
      weekdays: [],
      endDate: '2030-11-03',
    },
  ];

  it.each(cases)('roundtrips %s recurrence state', state => {
    const rule = buildRRule(state);

    expect(rule).not.toBeNull();
    if (!rule) {
      throw new Error('Expected RRULE to be built for valid recurrence state.');
    }
    expect(parseRRuleToFormState(rule)).toEqual(state);
  });

  it('rejects weekly recurrence without explicit weekdays', () => {
    expect(
      buildRRule({
        pattern: 'weekly',
        interval: 1,
        weekdays: [],
        endDate: null,
      })
    ).toBeNull();
  });
});
