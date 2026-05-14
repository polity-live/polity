import { describe, expect, it } from 'vitest';

import {
  buildWeekEventLayout,
  DEFAULT_WEEK_SELECTION_SLOT_SPAN,
  getDateForWeekSlot,
  getWeekGridDays,
  getWeekSelectionRange,
  WEEK_VIEW_SLOT_HEIGHT,
} from '../weekViewGrid';

describe('weekViewGrid', () => {
  it('builds a sunday-first week grid from the selected date', () => {
    const selectedDate = new Date('2026-05-13T15:00:00');
    const weekDays = getWeekGridDays(selectedDate);

    expect(weekDays).toHaveLength(7);
    expect(weekDays[0]?.getFullYear()).toBe(2026);
    expect(weekDays[0]?.getMonth()).toBe(4);
    expect(weekDays[0]?.getDate()).toBe(10);
    expect(weekDays[6]?.getFullYear()).toBe(2026);
    expect(weekDays[6]?.getMonth()).toBe(4);
    expect(weekDays[6]?.getDate()).toBe(16);
  });

  it('lays out overlapping events in separate columns and preserves duration height', () => {
    const weekDays = getWeekGridDays(new Date('2026-05-13T15:00:00'));
    const layout = buildWeekEventLayout(
      [
        {
          id: 'first',
          start_date: new Date('2026-05-12T09:00:00').getTime(),
          end_date: new Date('2026-05-12T10:00:00').getTime(),
        },
        {
          id: 'second',
          start_date: new Date('2026-05-12T09:30:00').getTime(),
          end_date: new Date('2026-05-12T11:00:00').getTime(),
        },
      ],
      weekDays
    );

    expect(layout).toHaveLength(2);
    expect(layout[0]?.dayIndex).toBe(2);
    expect(layout[0]?.columnCount).toBe(2);
    expect(layout[1]?.columnCount).toBe(2);
    expect(layout[0]?.column).toBe(0);
    expect(layout[1]?.column).toBe(1);
    expect(layout[0]?.height).toBe(WEEK_VIEW_SLOT_HEIGHT * 2);
    expect(layout[1]?.height).toBe(WEEK_VIEW_SLOT_HEIGHT * 3);
  });

  it('falls back to a single slot when an event has no valid end date', () => {
    const weekDays = getWeekGridDays(new Date('2026-05-13T15:00:00'));
    const layout = buildWeekEventLayout(
      [
        {
          id: 'fallback',
          start_date: new Date('2026-05-12T13:00:00').getTime(),
          end_date: 0,
        },
      ],
      weekDays
    );

    expect(layout[0]?.height).toBe(WEEK_VIEW_SLOT_HEIGHT);
  });

  it('expands single-click selection to the default span and drag selection to an inclusive range', () => {
    expect(getWeekSelectionRange(6, 6)).toEqual({
      startSlot: 6,
      endSlot: 6 + DEFAULT_WEEK_SELECTION_SLOT_SPAN,
    });

    expect(getWeekSelectionRange(8, 10)).toEqual({
      startSlot: 8,
      endSlot: 11,
    });

    expect(getWeekSelectionRange(10, 8)).toEqual({
      startSlot: 8,
      endSlot: 11,
    });
  });

  it('creates local dates for slot indices', () => {
    const day = new Date('2026-05-12T00:00:00');
    const slotDate = getDateForWeekSlot(day, 5);

    expect(slotDate.getFullYear()).toBe(2026);
    expect(slotDate.getMonth()).toBe(4);
    expect(slotDate.getDate()).toBe(12);
    expect(slotDate.getHours()).toBe(2);
    expect(slotDate.getMinutes()).toBe(30);
  });
});
