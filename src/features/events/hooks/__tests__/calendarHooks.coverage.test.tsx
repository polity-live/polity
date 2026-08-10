/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCalendarNavigation } from '@/features/calendar/hooks/useCalendarNavigation';
import { useCalendarEventFilter } from '../useCalendarEventFilter';
import { useCalendarView } from '../useCalendarView';

const event = (id: string, start: number, groupId = 'group-1') =>
  ({
    id,
    title: id,
    start_date: start,
    end_date: start + 60_000,
    group_id: groupId,
  }) as any;

describe('calendar navigation hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 12));
  });

  it.each([
    ['day', new Date(2026, 7, 8, 12), new Date(2026, 7, 10, 12)],
    ['week', new Date(2026, 7, 2, 12), new Date(2026, 7, 16, 12)],
    ['month', new Date(2026, 6, 9, 12), new Date(2026, 8, 9, 12)],
  ] as const)('moves the %s view backward, forward, and to today', (view, previous, next) => {
    const setSelectedDate = vi.fn();
    const selectedDate = new Date(2026, 7, 9, 12);
    const { result } = renderHook(() => useCalendarNavigation(view, selectedDate, setSelectedDate));

    act(() => result.current.goToPrevious());
    act(() => result.current.goToNext());
    act(() => result.current.goToToday());

    expect(setSelectedDate.mock.calls[0][0]).toEqual(previous);
    expect(setSelectedDate.mock.calls[1][0]).toEqual(next);
    expect(setSelectedDate.mock.calls[2][0]).toEqual(selectedDate);
  });

  it('tracks each active filter independently and clears local filters', () => {
    const events = [
      { ...event('Alpha', Date.UTC(2026, 7, 9)), groupName: 'One' },
      { ...event('Beta', Date.UTC(2026, 7, 10), 'group-2'), groupName: 'Two' },
    ];
    const hook = renderHook(
      ({ groupId }: { groupId?: string }) =>
        useCalendarEventFilter(events, groupId ? { selectedGroupId: groupId } : undefined),
      { initialProps: { groupId: undefined as string | undefined } }
    );

    expect(hook.result.current.hasActiveFilters).toBe(false);
    expect(hook.result.current.filteredBySearch).toHaveLength(2);

    act(() => hook.result.current.setSearchQuery('Alpha'));
    expect(hook.result.current.hasActiveFilters).toBe(true);
    expect(hook.result.current.filteredBySearch.map(item => item.id)).toEqual(['Alpha']);

    act(() => {
      hook.result.current.setSearchQuery('');
      hook.result.current.setDateFilter('2026-08-10');
    });
    expect(hook.result.current.hasActiveFilters).toBe(true);
    expect(hook.result.current.filteredBySearch.map(item => item.id)).toEqual(['Beta']);

    act(() => hook.result.current.clearFilters());
    hook.rerender({ groupId: 'group-2' });
    expect(hook.result.current.hasActiveFilters).toBe(true);
    expect(hook.result.current.filteredBySearch.map(item => item.id)).toEqual(['Beta']);
  });

  it('covers list, week, and month ranges, navigation, titles, and date comparisons', () => {
    const { result } = renderHook(() => useCalendarView());
    const sunday = new Date(2026, 7, 9, 12);
    act(() => result.current.setSelectedDate(sunday));

    expect(result.current.viewMode).toBe('week');
    expect(result.current.visibleRange.start).toEqual(new Date(2026, 7, 9, 0, 0, 0, 0));
    expect(result.current.visibleRange.end).toEqual(new Date(2026, 7, 15, 23, 59, 59, 999));
    expect(result.current.currentViewTitle).toContain('Aug');

    const events = [
      event('before', new Date(2026, 7, 8, 23).getTime()),
      event('start', new Date(2026, 7, 9).getTime()),
      event('middle', new Date(2026, 7, 12).getTime()),
      event('end', new Date(2026, 7, 15, 23, 59, 59, 999).getTime()),
      event('after', new Date(2026, 7, 16).getTime()),
    ];
    expect(result.current.filterEventsForRange(events).map(item => item.id)).toEqual([
      'start',
      'middle',
      'end',
    ]);
    expect(
      result.current
        .getEventsForDate(
          [
            event('same', new Date(2026, 7, 9, 10).getTime()),
            event('year', new Date(2025, 7, 9).getTime()),
            event('month', new Date(2026, 6, 9).getTime()),
            event('day', new Date(2026, 7, 10).getTime()),
          ],
          sunday
        )
        .map(item => item.id)
    ).toEqual(['same']);

    act(() => result.current.goToPrevious());
    expect(result.current.selectedDate).toEqual(new Date(2026, 7, 2, 12));
    act(() => result.current.goToNext());
    expect(result.current.selectedDate).toEqual(sunday);

    act(() => result.current.setViewMode('month'));
    expect(result.current.visibleRange).toEqual({
      start: new Date(2026, 7, 1),
      end: new Date(2026, 7, 31, 23, 59, 59, 999),
    });
    expect(result.current.currentViewTitle).toBe('August 2026');
    act(() => result.current.goToPrevious());
    expect(result.current.selectedDate).toEqual(new Date(2026, 6, 9, 12));
    act(() => result.current.goToNext());
    expect(result.current.selectedDate).toEqual(sunday);

    act(() => result.current.setViewMode('list'));
    expect(result.current.visibleRange.start).toEqual(new Date(2026, 7, 1));
    act(() => result.current.goToToday());
    expect(result.current.selectedDate).toEqual(sunday);
  });

  it('accepts explicit list initialization', () => {
    expect(renderHook(() => useCalendarView('list')).result.current.viewMode).toBe('list');
  });
});
