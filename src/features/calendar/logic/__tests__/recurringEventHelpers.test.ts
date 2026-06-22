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
  } as Parameters<typeof generateRecurringInstances>[0];
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
});
