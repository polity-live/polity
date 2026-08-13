import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadICalFile, generateICalString } from '../icalExport';

const mocks = vi.hoisted(() => {
  const createdEvents: {
    input: Record<string, unknown>;
    organizer: ReturnType<typeof vi.fn>;
    repeating: ReturnType<typeof vi.fn>;
  }[] = [];
  const createEvent = vi.fn((input: Record<string, unknown>) => {
    const event = { input, organizer: vi.fn(), repeating: vi.fn() };
    createdEvents.push(event);
    return event;
  });
  const toString = vi.fn(() => 'BEGIN:VCALENDAR\nEND:VCALENDAR');
  const calendarFactory = vi.fn((_options: object) => ({ createEvent, toString }));
  const formatNamedLocation = vi.fn((name?: string | null, _event?: object) => name?.trim() || '');

  return { createdEvents, createEvent, toString, calendarFactory, formatNamedLocation };
});

vi.mock('ical-generator', () => ({
  default: (options: object) => mocks.calendarFactory(options),
  ICalCalendarMethod: { PUBLISH: 'PUBLISH' },
  ICalEventRepeatingFreq: {
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
  },
}));

vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatNamedLocation: (name?: string | null, event?: object) =>
    mocks.formatNamedLocation(name, event),
}));

describe('icalExport', () => {
  beforeEach(() => {
    mocks.createdEvents.length = 0;
    mocks.createEvent.mockClear();
    mocks.toString.mockClear();
    mocks.calendarFactory.mockClear();
    mocks.formatNamedLocation.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates events, skips missing starts and normalizes optional fields', () => {
    expect(
      generateICalString(
        [
          { id: 'skip', title: 'Missing start' },
          {
            id: 'event-1',
            title: 'Assembly',
            description: null,
            location_name: ' ',
            start_date: 1_786_184_220_000,
          },
          {
            id: 'event-2',
            title: 'Meeting',
            description: 'Agenda',
            location_name: ' Town hall ',
            start_date: 1_786_270_620_000,
            end_date: 1_786_274_220_000,
          },
        ],
        'Civic calendar'
      )
    ).toBe('BEGIN:VCALENDAR\nEND:VCALENDAR');

    expect(mocks.calendarFactory).toHaveBeenCalledWith({
      name: 'Civic calendar',
      method: 'PUBLISH',
    });
    expect(mocks.createEvent).toHaveBeenCalledTimes(2);
    expect(mocks.createdEvents[0]?.input).toMatchObject({
      id: 'event-1',
      summary: 'Assembly',
      end: undefined,
      description: undefined,
      location: undefined,
    });
    expect(mocks.createdEvents[1]?.input).toMatchObject({
      id: 'event-2',
      summary: 'Meeting',
      description: 'Agenda',
      location: 'Town hall',
    });
  });

  it('adds organizers with explicit and fallback email addresses', () => {
    generateICalString([
      {
        id: 'event-1',
        title: 'One',
        start_date: 1,
        creator: { name: 'Ada', email: 'ada@example.test' },
      },
      { id: 'event-2', title: 'Two', start_date: 2, creator: { name: 'Grace' } },
      { id: 'event-3', title: 'Three', start_date: 3, creator: { email: 'ignored@test' } },
    ]);

    expect(mocks.createdEvents[0]?.organizer).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'ada@example.test',
    });
    expect(mocks.createdEvents[1]?.organizer).toHaveBeenCalledWith({
      name: 'Grace',
      email: 'noreply@polity.app',
    });
    expect(mocks.createdEvents[2]?.organizer).not.toHaveBeenCalled();
  });

  it('parses prefixed recurrence rules with interval and until', () => {
    generateICalString([
      {
        id: 'weekly',
        title: 'Weekly',
        start_date: 1,
        is_recurring: true,
        recurrence_rule: 'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20260803T120000',
      },
    ]);

    expect(mocks.createdEvents[0]?.repeating).toHaveBeenCalledWith({
      freq: 'WEEKLY',
      interval: 2,
      until: new Date('2026-08-03T12:00:00'),
    });
  });

  it('uses recurrence end dates and supports unprefixed frequency rules', () => {
    const recurrenceEnd = 1_786_356_000_000;
    generateICalString([
      {
        id: 'daily',
        title: 'Daily',
        start_date: 1,
        is_recurring: true,
        recurrence_rule: 'FREQ=DAILY',
        recurrence_end_date: recurrenceEnd,
      },
      {
        id: 'monthly',
        title: 'Monthly',
        start_date: 2,
        is_recurring: true,
        recurrence_rule: 'FREQ=MONTHLY',
      },
      {
        id: 'yearly',
        title: 'Yearly',
        start_date: 3,
        is_recurring: true,
        recurrence_rule: 'FREQ=YEARLY',
      },
    ]);

    expect(mocks.createdEvents[0]?.repeating).toHaveBeenCalledWith({
      freq: 'DAILY',
      interval: undefined,
      until: new Date(recurrenceEnd),
    });
    expect(mocks.createdEvents[1]?.repeating).toHaveBeenCalledWith({
      freq: 'MONTHLY',
      interval: undefined,
      until: undefined,
    });
    expect(mocks.createdEvents[2]?.repeating).toHaveBeenCalledWith({
      freq: 'YEARLY',
      interval: undefined,
      until: undefined,
    });
  });

  it('ignores disabled, missing and unsupported recurrence rules', () => {
    generateICalString([
      { id: 'disabled', title: 'Disabled', start_date: 1, recurrence_rule: 'FREQ=DAILY' },
      { id: 'missing', title: 'Missing', start_date: 2, is_recurring: true },
      {
        id: 'unsupported',
        title: 'Unsupported',
        start_date: 3,
        is_recurring: true,
        recurrence_rule: 'FREQ=HOURLY;BROKEN',
      },
    ]);

    expect(mocks.createdEvents.every(event => event.repeating.mock.calls.length === 0)).toBe(true);
  });

  it('downloads the generated calendar and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:calendar');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const anchor = { href: '', download: '', click: vi.fn() };
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    });

    downloadICalFile([{ id: 'event-1', title: 'Assembly', start_date: 1 }], 'assembly.ics');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor).toMatchObject({ href: 'blob:calendar', download: 'assembly.ics' });
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:calendar');
  });

  it('uses the public defaults for calendar and file names', () => {
    const createObjectURL = vi.fn(() => 'blob:default');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const anchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    downloadICalFile([]);

    expect(anchor.download).toBe('polity-calendar.ics');
    expect(mocks.calendarFactory).toHaveBeenCalledWith({
      name: 'Polity Calendar',
      method: 'PUBLISH',
    });
  });
});
