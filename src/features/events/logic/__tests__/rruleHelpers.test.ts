import { afterEach, describe, expect, it, vi } from 'vitest';
import { RRule } from 'rrule';
import {
  buildRRule,
  getRecurrenceDescription,
  parseRRuleToFormState,
  type RecurrenceFormState,
} from '@/features/events/logic/rruleHelpers';

describe('rruleHelpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('rejects none, unknown patterns, and invalid end dates while defaulting intervals', () => {
    expect(buildRRule({ pattern: 'none', interval: 1, weekdays: [], endDate: null })).toBeNull();
    expect(
      buildRRule({ pattern: 'unknown' as never, interval: 1, weekdays: [], endDate: null })
    ).toBeNull();
    expect(
      buildRRule({ pattern: 'daily', interval: 0, weekdays: [], endDate: 'invalid' })
    ).toBeNull();
    expect(buildRRule({ pattern: 'daily', interval: 0, weekdays: [], endDate: null })).toContain(
      'INTERVAL=1'
    );
    expect(
      buildRRule({ pattern: 'four-yearly', interval: 0, weekdays: [], endDate: null })
    ).toContain('INTERVAL=4');
  });

  it('parses prefixed rules, absent weekdays/until, and unusual weekday representations', () => {
    expect(parseRRuleToFormState('RRULE:FREQ=DAILY')).toMatchObject({
      pattern: 'daily',
      interval: 1,
      weekdays: [],
      endDate: null,
    });

    vi.spyOn(RRule, 'fromString').mockReturnValueOnce({
      origOptions: { freq: 999, interval: undefined, byweekday: 2, until: null },
    } as never);
    expect(parseRRuleToFormState('custom')).toEqual({
      pattern: 'none',
      interval: 1,
      weekdays: [2],
      endDate: null,
    });

    vi.spyOn(RRule, 'fromString').mockReturnValueOnce({
      origOptions: { freq: RRule.WEEKLY, interval: 1, byweekday: ['XX', 'MO', { weekday: 4 }] },
    } as never);
    expect(parseRRuleToFormState('custom')).toMatchObject({
      pattern: 'weekly',
      weekdays: [0, 0, 4],
    });
  });

  it('describes every recurrence pattern, intervals, weekdays, absence, and invalid rules', () => {
    const t = (key: string) => key.split('.').at(-1)!;
    expect(getRecurrenceDescription(null, t)).toBe('none');
    expect(getRecurrenceDescription('FREQ=DAILY;INTERVAL=1', t)).toBe('daily');
    expect(getRecurrenceDescription('FREQ=DAILY;INTERVAL=2', t)).toBe('daily (2)');
    expect(getRecurrenceDescription('FREQ=WEEKLY;BYDAY=MO,WE', t)).toBe(
      'weekly: monday, wednesday'
    );
    expect(getRecurrenceDescription('FREQ=WEEKLY', t)).toBe('weekly');
    expect(getRecurrenceDescription('FREQ=MONTHLY', t)).toBe('monthly');
    expect(getRecurrenceDescription('FREQ=YEARLY;INTERVAL=1', t)).toBe('yearly');
    expect(getRecurrenceDescription('FREQ=YEARLY;INTERVAL=2', t)).toBe('yearly (2)');
    expect(getRecurrenceDescription('FREQ=YEARLY;INTERVAL=4', t)).toBe('fourYearly');
    expect(getRecurrenceDescription('invalid', t)).toBe('invalid');

    vi.spyOn(RRule, 'fromString').mockReturnValueOnce({
      origOptions: { freq: 999, interval: 1 },
    } as never);
    expect(getRecurrenceDescription('custom', t)).toBe('custom');
  });
});
