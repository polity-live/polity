import { describe, expect, it } from 'vitest';

import {
  buildDayTimeLayout,
  buildWeekEventLayout,
  getDateForWeekSlot,
  getMinutesSinceMidnight,
  getWeekEventRange,
  getWeekGridDays,
  getWeekSelectionRange,
  isSameWeekGridDay,
  WEEK_VIEW_DAY_MINUTES,
  WEEK_VIEW_SLOTS_PER_DAY,
} from '../weekViewGrid';

describe('weekViewGrid', () => {
  it('builds Sunday-based weeks and compares every date component', () => {
    const day = new Date(2030, 4, 15, 12, 0);
    expect(isSameWeekGridDay(new Date(2030, 4, 15, 8), day)).toBe(true);
    expect(isSameWeekGridDay(new Date(2029, 4, 15), day)).toBe(false);
    expect(isSameWeekGridDay(new Date(2030, 3, 15), day)).toBe(false);
    expect(isSameWeekGridDay(new Date(2030, 4, 16), day)).toBe(false);
    const days = getWeekGridDays(day);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
    expect(getMinutesSinceMidnight(new Date(2030, 4, 15, 8, 30))).toBe(510);
  });

  it('normalizes explicit, missing, short, and boundary event ranges', () => {
    const start = new Date(2030, 0, 1, 10, 0);
    expect(getWeekEventRange({ id: 'missing', start_date: start })).toEqual({
      startMinute: 600,
      endMinute: 630,
    });
    expect(getWeekEventRange({ id: 'null', start_date: start, end_date: null })).toEqual({
      startMinute: 600,
      endMinute: 630,
    });
    expect(
      getWeekEventRange({ id: 'short', start_date: start, end_date: new Date(2030, 0, 1, 9) })
    ).toEqual({ startMinute: 600, endMinute: 630 });
    expect(
      getWeekEventRange({
        id: 'long',
        start_date: new Date(2030, 0, 1, 23, 50),
        end_date: new Date(2030, 0, 1, 23, 59),
      })
    ).toEqual({ startMinute: 1430, endMinute: WEEK_VIEW_DAY_MINUTES });
  });

  it('sorts, clusters, reuses columns, and separates nonoverlapping layouts', () => {
    const items = [
      {
        end: new Date(2030, 0, 1, 10, 30).getTime(),
        id: 'later',
        start: new Date(2030, 0, 1, 10).getTime(),
      },
      {
        end: new Date(2030, 0, 1, 10, 45).getTime(),
        id: 'long',
        start: new Date(2030, 0, 1, 9).getTime(),
      },
      {
        end: new Date(2030, 0, 1, 9, 30).getTime(),
        id: 'short',
        start: new Date(2030, 0, 1, 9).getTime(),
      },
      { end: 0, id: 'fallback', start: new Date(2030, 0, 1, 11).getTime() },
      { end: null, id: 'null-end', start: new Date(2030, 0, 1, 12).getTime() },
    ];
    const layout = buildDayTimeLayout(
      items,
      item => item.start,
      item => item.end
    );
    expect(layout.map(item => item.item.id)).toEqual([
      'short',
      'long',
      'later',
      'fallback',
      'null-end',
    ]);
    expect(layout[0].columnCount).toBe(2);
    expect(layout[2].column).toBe(0);
    expect(layout[3].columnCount).toBe(1);
    expect(
      buildDayTimeLayout(
        [],
        () => 0,
        () => null
      )
    ).toEqual([]);
  });

  it('maps events to their week day and ignores outside events', () => {
    const days = getWeekGridDays(new Date(2030, 0, 2));
    const events = [
      { id: 'inside', start_date: new Date(days[1]).setHours(8), end_date: undefined },
      { id: 'outside', start_date: new Date(2040, 0, 1), end_date: undefined },
    ];
    const layout = buildWeekEventLayout(events, days);
    expect(layout).toHaveLength(1);
    expect(layout[0]).toMatchObject({ dayIndex: 1, event: events[0] });
  });

  it('clamps and orders selection ranges and slot dates', () => {
    expect(getWeekSelectionRange(4, 4)).toEqual({ startSlot: 4, endSlot: 6 });
    expect(getWeekSelectionRange(47, 47, 4)).toEqual({
      startSlot: 47,
      endSlot: WEEK_VIEW_SLOTS_PER_DAY,
    });
    expect(getWeekSelectionRange(8, 3)).toEqual({ startSlot: 3, endSlot: 9 });
    expect(getWeekSelectionRange(-2, 99)).toEqual({
      startSlot: 0,
      endSlot: WEEK_VIEW_SLOTS_PER_DAY,
    });
    const day = new Date(2030, 0, 1);
    expect(getDateForWeekSlot(day, 3).getHours()).toBe(1);
    expect(getDateForWeekSlot(day, -1).getHours()).toBe(0);
    expect(getDateForWeekSlot(day, 99).getDate()).toBe(2);
  });
});
