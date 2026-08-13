/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarHeaderView } from '../CalendarHeaderView';
import { CalendarPageView } from '../CalendarPageView';

const mocks = vi.hoisted(() => ({
  headerProps: null as any,
  filterProps: null as any,
  viewProps: null as any,
  exportProps: null as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/tabs', () => {
  let value: string;
  let onValueChange: (value: string) => void;
  return {
    Tabs: ({ children, value: nextValue, onValueChange: nextOnValueChange }: any) => {
      value = nextValue;
      onValueChange = nextOnValueChange;
      return <div>{children}</div>;
    },
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children, value: triggerValue, ...props }: any) => (
      <button
        role="tab"
        data-state={value === triggerValue ? 'active' : 'inactive'}
        onClick={() => onValueChange(triggerValue)}
        {...props}
      >
        {children}
      </button>
    ),
  };
});
vi.mock('@/features/shared/ui/calendar', () => ({
  CalendarHeader: (props: any) => {
    mocks.headerProps = props;
    return <header>{props.actions}</header>;
  },
  CalendarFilterBar: (props: any) => {
    mocks.filterProps = props;
    return <section>{props.middleFilter}</section>;
  },
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label, variant }: any) => (
    <div>
      {variant}:{label}
    </div>
  ),
}));
vi.mock('@/features/events/ui/calendar/CalendarExportButton', () => ({
  CalendarExportButton: (props: any) => {
    mocks.exportProps = props;
    return <button data-action-id={props['data-action-id']}>export</button>;
  },
}));
vi.mock('@/features/events/ui/calendar/CalendarViewContainer', () => ({
  CalendarViewContainer: (props: any) => {
    mocks.viewProps = props;
    return <div>calendar-view</div>;
  },
}));
vi.mock('../CalendarGroupFilter', () => ({
  CalendarGroupFilter: (props: any) => <div>group-filter:{props.selectedGroupId}</div>,
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.headerProps = null;
  mocks.filterProps = null;
  mocks.viewProps = null;
  mocks.exportProps = null;
});

describe('calendar header and page', () => {
  it('invokes period, creation, and selected view actions with native focus and keyboard behavior', () => {
    const callbacks = {
      setView: vi.fn(),
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onToday: vi.fn(),
      onCreateEvent: vi.fn(),
    };
    render(<CalendarHeaderView view="week" currentViewTitle="August 2026" {...callbacks} />);
    const create = screen.getByRole('button', { name: 'features.calendar.actions.createEvent' });
    create.focus();
    expect(document.activeElement).toBe(create);
    fireEvent.keyDown(create, { key: 'Enter' });
    fireEvent.click(create);
    fireEvent.click(document.querySelector('[data-action-id="calendar.header.period.previous"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'features.calendar.today' }));
    fireEvent.click(document.querySelector('[data-action-id="calendar.header.period.next"]')!);
    fireEvent.click(screen.getByRole('tab', { name: 'features.calendar.views.month' }));
    expect(callbacks.onCreateEvent).toHaveBeenCalledOnce();
    expect(callbacks.onPrevious).toHaveBeenCalledOnce();
    expect(callbacks.onToday).toHaveBeenCalledOnce();
    expect(callbacks.onNext).toHaveBeenCalledOnce();
    expect(callbacks.setView).toHaveBeenCalledWith('month');
    expect(
      screen.getByRole('tab', { name: 'features.calendar.views.week' }).getAttribute('data-state')
    ).toBe('active');
  });

  it('renders loading independently and forwards the complete ready-page interaction contract', () => {
    const base: any = {
      isLoading: true,
      loadingLabel: 'Loading calendar',
      title: 'Calendar',
      createEventLabel: 'Create event',
      viewMode: 'month',
      setViewMode: vi.fn(),
      currentViewTitle: 'August',
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onToday: vi.fn(),
      onCreateEvent: vi.fn(),
      searchQuery: 'budget',
      onSearchChange: vi.fn(),
      dateFilter: '2026-08',
      onDateFilterChange: vi.fn(),
      groupItems: [],
      selectedGroupId: 'group-1',
      onGroupChange: vi.fn(),
      selectedDate: new Date(2026, 7, 2),
      onDateSelect: vi.fn(),
      events: [{ id: 'event-1' }],
      filteredEvents: [{ id: 'event-1' }],
      onEventSelect: vi.fn(),
      onCreateEventRange: vi.fn(),
      swipeHandlers: { onTouchStart: vi.fn() },
    };
    const { rerender } = render(<CalendarPageView {...base} />);
    expect(screen.getByText('calendar:Loading calendar')).toBeTruthy();
    rerender(<CalendarPageView {...base} isLoading={false} />);
    expect(screen.getByText('calendar-view')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(base.onCreateEvent).toHaveBeenCalledOnce();
    expect(mocks.headerProps).toMatchObject({
      viewMode: 'month',
      currentViewTitle: 'August',
      headingMode: 'sr-only',
    });
    expect(mocks.filterProps).toMatchObject({ searchQuery: 'budget', dateFilter: '2026-08' });
    expect(mocks.exportProps).toMatchObject({
      events: base.events,
      'data-action-id': 'calendar.page.events.export',
    });
    expect(mocks.viewProps).toMatchObject({
      viewMode: 'month',
      events: base.filteredEvents,
      allEvents: base.events,
      listQueryScope: { query: 'budget' },
    });
  });
});
