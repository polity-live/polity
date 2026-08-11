import { describe, expect, it } from 'vitest';

import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import {
  getCompactCalendarEventClassName,
  getCompactCalendarEventMetaClassName,
} from '../compactCalendarEventStyles';

const event = (values: Partial<CalendarEvent>) => values as CalendarEvent;

describe('compact calendar event styles', () => {
  it('assigns distinct semantic surfaces to booked, bookable, and closed meetings', () => {
    const booked = getCompactCalendarEventClassName(
      event({ isMeeting: true, isBookedByMe: true, is_bookable: true })
    );
    const bookable = getCompactCalendarEventClassName(
      event({ isMeeting: true, isBookedByMe: false, is_bookable: true })
    );
    const closed = getCompactCalendarEventClassName(
      event({ isMeeting: true, isBookedByMe: false, is_bookable: false })
    );

    expect(booked).not.toBe(bookable);
    expect(bookable).not.toBe(closed);
    expect(new Set([booked, bookable, closed]).size).toBe(3);
  });

  it('uses the event gradient and event text only for non-meeting events', () => {
    const ordinary = event({ isMeeting: false });
    const meeting = event({ isMeeting: true });

    expect(getCompactCalendarEventClassName(ordinary)).toContain('border');
    expect(getCompactCalendarEventClassName(ordinary)).not.toBe(
      getCompactCalendarEventClassName(meeting)
    );
    expect(getCompactCalendarEventMetaClassName(ordinary)).not.toBe('text-muted-foreground');
    expect(getCompactCalendarEventMetaClassName(meeting)).toBe('text-muted-foreground');
  });
});
