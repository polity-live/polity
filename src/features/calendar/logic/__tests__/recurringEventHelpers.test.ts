import { describe, expect, it } from 'vitest';

import { generateRecurringInstances } from '../recurringEventHelpers';

const eventStart = Date.UTC(2026, 0, 1, 10, 0, 0);
const eventEnd = Date.UTC(2026, 0, 1, 11, 0, 0);

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Daily sync',
    description: null,
    start_date: eventStart,
    end_date: eventEnd,
    is_recurring: false,
    recurrence_pattern: null,
    recurrence_rule: null,
    recurrence_interval: null,
    recurrence_days: null,
    recurrence_end_date: null,
    exceptions: [],
    location_name: null,
    country: null,
    region: null,
    post_code: null,
    city: null,
    street: null,
    house_number: null,
    ...overrides,
  } as unknown as Parameters<typeof generateRecurringInstances>[0];
}

describe('generateRecurringInstances', () => {
  it('expands recurring events from their RRULE', () => {
    const event = createEvent({
      is_recurring: true,
      recurrence_rule: 'FREQ=DAILY;COUNT=3',
    });

    const instances = generateRecurringInstances(
      event,
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 4))
    );

    expect(instances).toHaveLength(3);
    expect(instances.map(instance => instance.start_date)).toEqual([
      Date.UTC(2026, 0, 1, 10, 0, 0),
      Date.UTC(2026, 0, 2, 10, 0, 0),
      Date.UTC(2026, 0, 3, 10, 0, 0),
    ]);
    expect(instances[0].id).toBe('event-1');
    expect(instances[1].id).toBe('event-1_rrule_1');
    expect(instances[1].recurringParentId).toBe('event-1');
  });

  it('does not expand pattern-only recurrence data', () => {
    const event = createEvent({
      is_recurring: true,
      recurrence_pattern: 'daily',
      recurrence_interval: 1,
    });

    const instances = generateRecurringInstances(
      event,
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 4))
    );

    expect(instances).toEqual([event]);
  });

  it('keeps recurring events without a complete duration unchanged', () => {
    const missingStart = createEvent({
      is_recurring: true,
      recurrence_rule: 'FREQ=DAILY;COUNT=2',
      start_date: null,
    });
    const missingEnd = createEvent({
      is_recurring: true,
      recurrence_rule: 'FREQ=DAILY;COUNT=2',
      end_date: null,
    });
    const rangeStart = new Date(Date.UTC(2026, 0, 1));
    const rangeEnd = new Date(Date.UTC(2026, 0, 4));

    expect(generateRecurringInstances(missingStart, rangeStart, rangeEnd)).toEqual([missingStart]);
    expect(generateRecurringInstances(missingEnd, rangeStart, rangeEnd)).toEqual([missingEnd]);
  });

  it('applies modified occurrences, skips cancellations, and ignores unrelated exceptions', () => {
    const event = createEvent({
      is_recurring: true,
      recurrence_rule: 'RRULE:FREQ=DAILY;COUNT=4',
    });
    const modifiedStart = Date.UTC(2026, 0, 2, 12);
    const modifiedEnd = Date.UTC(2026, 0, 2, 13, 30);
    const exceptions = [
      {
        id: 'modified',
        original_date: Date.UTC(2026, 0, 2),
        action: 'modified',
        new_start_date: modifiedStart,
        new_end_date: modifiedEnd,
        new_title: 'Moved sync',
        new_description: 'Moved description',
        new_location_name: 'Room B',
        new_country: 'DE',
        new_region: 'BE',
        new_post_code: '10115',
        new_city: 'Berlin',
        new_street: 'Main Street',
        new_house_number: '2',
      },
      {
        id: 'cancelled',
        original_date: Date.UTC(2026, 0, 3),
        action: 'cancelled',
      },
      {
        id: 'ignored',
        original_date: Date.UTC(2026, 0, 4),
        action: 'unchanged',
      },
    ] as any;

    const instances = generateRecurringInstances(
      event,
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 5)),
      exceptions
    );

    expect(instances).toHaveLength(3);
    expect(instances[1]).toMatchObject({
      start_date: modifiedStart,
      end_date: modifiedEnd,
      title: 'Moved sync',
      description: 'Moved description',
      location_name: 'Room B',
      city: 'Berlin',
    });
    expect(instances.map(instance => instance.instanceDate)).not.toContain('2026-01-03');
    expect(instances[2]).toMatchObject({
      title: 'Daily sync',
      start_date: Date.UTC(2026, 0, 4, 10),
      end_date: Date.UTC(2026, 0, 4, 11),
    });
  });
});
