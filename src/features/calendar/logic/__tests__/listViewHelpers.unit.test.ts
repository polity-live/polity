import { describe, expect, it, vi } from 'vitest';

import {
  getCalendarEventsForView,
  getDateKey,
  getListAnchorDateKey,
  getMarkerInsertionIndex,
  getMarkerViewportState,
} from '../listViewHelpers';

describe('listViewHelpers', () => {
  it('returns all filtered events in list view', () => {
    const rangeFilter = vi.fn((values: number[]) => values.slice(0, 1));

    expect(getCalendarEventsForView('list', [1, 2, 3], rangeFilter)).toEqual([1, 2, 3]);
    expect(rangeFilter).not.toHaveBeenCalled();
  });

  it('uses the visible range filter in week and month views', () => {
    const rangeFilter = vi.fn((values: number[]) => values.slice(1));

    expect(getCalendarEventsForView('week', [1, 2, 3], rangeFilter)).toEqual([2, 3]);
    expect(getCalendarEventsForView('month', [1, 2, 3], rangeFilter)).toEqual([2, 3]);
    expect(rangeFilter).toHaveBeenCalledTimes(2);
  });

  it('anchors the list to the selected date when that date has events', () => {
    expect(
      getListAnchorDateKey(
        ['2026-05-13', '2026-05-14', '2026-05-15'],
        new Date('2026-05-14T12:00:00')
      )
    ).toBe('2026-05-14');
  });

  it('has no list anchor when no event dates exist', () => {
    expect(getListAnchorDateKey([], new Date('2026-05-14T12:00:00'))).toBeNull();
  });

  it('anchors the list to the next future event date when today has no events', () => {
    expect(
      getListAnchorDateKey(
        ['2026-05-10', '2026-05-16', '2026-05-20'],
        new Date('2026-05-14T12:00:00')
      )
    ).toBe('2026-05-16');
  });

  it('anchors to the last available date when all events are in the past', () => {
    expect(
      getListAnchorDateKey(
        ['2026-05-01', '2026-05-05', '2026-05-10'],
        new Date('2026-05-14T12:00:00')
      )
    ).toBe('2026-05-10');
  });

  it('formats date keys in the same order the list uses', () => {
    expect(getDateKey(new Date('2026-05-04T12:00:00'))).toBe('2026-05-04');
  });

  it('inserts the today marker before the first future date when today has no events', () => {
    expect(
      getMarkerInsertionIndex(
        ['2026-05-10', '2026-05-16', '2026-05-20'],
        new Date('2026-05-14T12:00:00')
      )
    ).toBe(1);
  });

  it('places the today marker at the end when every event is in the past', () => {
    expect(
      getMarkerInsertionIndex(
        ['2026-05-01', '2026-05-05', '2026-05-10'],
        new Date('2026-05-14T12:00:00')
      )
    ).toBe(3);
  });

  it('reports when the today marker is above the viewport', () => {
    expect(getMarkerViewportState({ top: -60, bottom: -20 }, { top: 0, bottom: 500 })).toBe(
      'above'
    );
  });

  it('reports when the today marker is below the viewport', () => {
    expect(getMarkerViewportState({ top: 520, bottom: 560 }, { top: 0, bottom: 500 })).toBe(
      'below'
    );
  });

  it('reports when the today marker is visible in the viewport', () => {
    expect(getMarkerViewportState({ top: 120, bottom: 160 }, { top: 0, bottom: 500 })).toBe(
      'visible'
    );
  });
});
