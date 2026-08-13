/* @vitest-environment jsdom */

import { act, cleanup, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pageView: vi.fn(() => null),
  headerView: vi.fn((_props: any) => null),
  weekView: vi.fn((_props: any) => null),
  navigate: vi.fn(),
  swipe: vi.fn(() => ({ handlers: { onTouchStart: vi.fn() } })),
  previous: vi.fn(),
  next: vi.fn(),
}));
const pageModel = vi.hoisted(() => ({
  isLoading: false,
  t: (key: string) => key,
  viewMode: 'month',
  setViewMode: vi.fn(),
  currentViewTitle: 'August',
  goToPrevious: mocks.previous,
  goToNext: mocks.next,
  goToToday: vi.fn(),
  onCreateEvent: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  dateFilter: null,
  setDateFilter: vi.fn(),
  groupItems: [],
  selectedGroupId: null,
  setSelectedGroupId: vi.fn(),
  selectedDate: new Date('2026-08-10T00:00:00Z'),
  setSelectedDate: vi.fn(),
  events: [],
  filteredEvents: [],
  onEventSelect: vi.fn(),
  onCreateEventRange: vi.fn(),
}));

vi.mock('../hooks/useCalendarPage', () => ({ useCalendarPage: () => pageModel }));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: mocks.swipe,
}));
vi.mock('@/features/auth/AuthGuard.tsx', () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../ui/CalendarPageView', () => ({ CalendarPageView: mocks.pageView }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../ui/CalendarHeaderView', () => ({ CalendarHeaderView: mocks.headerView }));
vi.mock('../ui/WeekViewView', () => ({ WeekViewView: mocks.weekView }));
vi.mock('../logic/eventIdUtils', () => ({ getBaseEventId: (id: string) => `base:${id}` }));

import CalendarPage from '../CalendarPage';
import { useCalendarState } from '../hooks/useCalendarState';
import { CalendarHeader } from '../ui/CalendarHeader';
import { WeekView } from '../ui/WeekView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('calendar LSF wrapper contracts', () => {
  it('connects the page model, shell, and swipe handlers', () => {
    render(<CalendarPage />);

    expect(mocks.swipe).toHaveBeenCalledWith({
      onSwipePrev: mocks.previous,
      onSwipeNext: mocks.next,
      keyboardMode: 'global',
    });
    expect(mocks.pageView).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'features.calendar.title',
        currentViewTitle: 'August',
        swipeHandlers: expect.any(Object),
      }),
      undefined
    );
  });

  it('owns mutable calendar view and date state', () => {
    const { result } = renderHook(() => useCalendarState());
    const selectedDate = new Date('2026-08-11T00:00:00Z');
    act(() => {
      result.current.setView('week');
      result.current.setSelectedDate(selectedDate);
    });
    expect(result.current.view).toBe('week');
    expect(result.current.selectedDate).toBe(selectedDate);
  });

  it('routes calendar header creation and week event selection', () => {
    render(
      <>
        <CalendarHeader
          view="week"
          setView={vi.fn()}
          currentViewTitle="Week"
          onPrevious={vi.fn()}
          onNext={vi.fn()}
          onToday={vi.fn()}
        />
        <WeekView selectedDate={new Date()} events={[]} allEvents={[]} />
      </>
    );

    const headerProps = mocks.headerView.mock.calls[0][0];
    const weekProps = mocks.weekView.mock.calls[0][0];
    headerProps.onCreateEvent();
    weekProps.onEventOpen('event:instance');
    expect(mocks.navigate).toHaveBeenNthCalledWith(1, { to: '/create/event' });
    expect(mocks.navigate).toHaveBeenNthCalledWith(2, { to: '/event/base:event:instance' });
  });
});
