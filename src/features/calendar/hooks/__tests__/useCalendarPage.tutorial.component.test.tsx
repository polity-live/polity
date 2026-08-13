/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE } from '@/features/app-tutorial/events';

const mocks = vi.hoisted(() => ({
  events: [] as any[],
  navigate: vi.fn(),
  setSelectedDate: vi.fn(),
  useCalendarData: vi.fn(),
}));

vi.mock('../useCalendarData', () => ({
  useCalendarData: mocks.useCalendarData,
}));
vi.mock('@/features/events/hooks/useCalendarView', () => ({
  useCalendarView: () => ({
    viewMode: 'week',
    setViewMode: vi.fn(),
    selectedDate: new Date(0),
    setSelectedDate: mocks.setSelectedDate,
    currentViewTitle: 'Week',
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    goToToday: vi.fn(),
    filterEventsForRange: (events: unknown[]) => events,
  }),
}));
vi.mock('@/features/events/hooks/useCalendarEventFilter', () => ({
  useCalendarEventFilter: (events: unknown[]) => ({
    filteredBySearch: events,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    dateFilter: '',
    setDateFilter: vi.fn(),
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

import { useCalendarPage } from '../useCalendarPage';

describe('useCalendarPage tutorial alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events.length = 0;
    mocks.useCalendarData.mockImplementation(() => ({
      events: [...mocks.events],
      isLoading: false,
    }));
    document.body.removeAttribute(APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE);
  });

  it('moves the calendar to the earliest tutorial event while the tutorial is active', () => {
    mocks.events.push(
      { id: 'later', tutorial_run_id: 'run-1', start_date: 300, end_date: 400 },
      {
        id: 'earlier',
        tutorial_run_id: 'run-1',
        start_date: 200,
        end_date: 300,
      }
    );
    document.body.setAttribute(APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE, 'true');

    renderHook(() => useCalendarPage());

    expect(mocks.setSelectedDate).toHaveBeenCalledWith(new Date(200));
  });

  it.each([
    ['inactive tutorial', false, true],
    ['no tutorial events', true, false],
  ])('does not move the calendar for %s', (_case, active, hasEvent) => {
    if (active) document.body.setAttribute(APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE, 'true');
    if (hasEvent) {
      mocks.events.push({
        id: 'event-1',
        tutorial_run_id: 'run-1',
        start_date: 200,
        end_date: 300,
      });
    }

    renderHook(() => useCalendarPage());

    expect(mocks.setSelectedDate).not.toHaveBeenCalled();
  });

  it('deduplicates complete group options and forwards event and create navigation', () => {
    mocks.events.push(
      { id: 'missing-id', groupName: 'Ignored', start_date: 100, end_date: 200 },
      { id: 'missing-name', group_id: 'group-missing', start_date: 100, end_date: 200 },
      {
        id: 'event-rrule-1',
        group_id: 'group-z',
        groupName: 'Zulu',
        start_date: 100,
        end_date: 200,
      },
      {
        id: 'duplicate',
        group_id: 'group-z',
        groupName: 'Duplicate',
        start_date: 100,
        end_date: 200,
      },
      {
        id: 'tutorial_rrule_2',
        group_id: 'group-a',
        groupName: 'Alpha',
        tutorial_run_id: 'run-1',
        start_date: 300,
        end_date: 400,
      }
    );

    const { result } = renderHook(() => useCalendarPage());

    expect(result.current.groupItems.map(item => item.label)).toEqual(['Alpha', 'Zulu']);
    act(() => result.current.onEventSelect(mocks.events[2]));
    act(() => result.current.onEventSelect(mocks.events[4]));
    act(() =>
      result.current.onCreateEventRange({
        start: new Date(2026, 7, 9, 9),
        end: new Date(2026, 7, 9, 10),
      })
    );
    act(() => result.current.onCreateEvent());

    expect(mocks.navigate).toHaveBeenNthCalledWith(1, {
      to: '/event/$id',
      params: { id: 'event-rrule-1' },
    });
    expect(mocks.navigate).toHaveBeenNthCalledWith(2, {
      to: '/event/$id/agenda',
      params: { id: 'tutorial' },
    });
    expect(mocks.navigate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ to: '/create/event', search: expect.any(Object) })
    );
    expect(mocks.navigate).toHaveBeenNthCalledWith(4, { to: '/create/event' });
  });
});
