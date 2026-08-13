/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarGroupFilter } from '../CalendarGroupFilter';
import { CalendarStats } from '../CalendarStats';
import { DayView } from '../DayView';
import { MiniCalendar } from '../MiniCalendar';
import { MonthView } from '../MonthView';
import { MonthViewView } from '../MonthViewView';
import { WeekViewView } from '../WeekViewView';

const mocks = vi.hoisted(() => ({
  typeaheadProps: null as any,
  calendarProps: [] as any[],
  agendas: [] as any[],
  timelines: [] as any[],
  navigate: vi.fn(),
  language: 'en',
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: any) => {
    mocks.typeaheadProps = props;
    return <button onClick={() => props.onChange({ id: 'group-2' })}>{props.placeholder}</button>;
  },
}));
vi.mock('@/features/shared/ui/ui/calendar', () => ({
  Calendar: (props: any) => {
    mocks.calendarProps.push(props);
    return <button onClick={() => props.onSelect?.(new Date(2026, 7, 3))}>calendar-control</button>;
  },
}));
vi.mock('@/features/agendas/ui/TimelineItem', () => ({
  TimelineItem: (props: any) => {
    mocks.timelines.push(props);
    return <div>{props.children}</div>;
  },
}));
vi.mock('@/features/agendas/ui/AgendaCard', () => ({
  AgendaCard: (props: any) => {
    mocks.agendas.push(props);
    return <article>{props.title}</article>;
  },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.calendarProps = [];
  mocks.agendas = [];
  mocks.timelines = [];
  mocks.language = 'en';
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 2, 12));
});
afterEach(() => vi.useRealTimers());

function calendarEvent(id: string, start: Date, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    title: id,
    description: `${id} description`,
    start_date: start.getTime(),
    end_date: start.getTime() + 90 * 60_000,
    location: 'Town hall',
    visibility: 'public',
    ...overrides,
  };
}

describe('calendar view components', () => {
  it('adapts group typeahead selection and clear values without mutating identifiers', () => {
    const onGroupChange = vi.fn();
    render(
      <CalendarGroupFilter
        items={[{ id: 'group-1', label: 'Council', entityType: 'group' }]}
        selectedGroupId="group-1"
        onGroupChange={onGroupChange}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onGroupChange).toHaveBeenCalledWith('group-2');
    expect(mocks.typeaheadProps).toMatchObject({
      value: 'group-1',
      placeholder: 'features.calendar.search.groupPlaceholder',
      className: 'w-full',
    });
    mocks.typeaheadProps.onChange(undefined);
    expect(onGroupChange).toHaveBeenLastCalledWith('');

    cleanup();
    render(
      <CalendarGroupFilter
        items={[{ id: 'group-1', label: 'Council', entityType: 'group' }]}
        selectedGroupId=""
        onGroupChange={onGroupChange}
      />
    );
    expect(mocks.typeaheadProps.value).toBeUndefined();
  });

  it('marks event dates and forwards only valid mini-calendar selections', () => {
    const selected = new Date(2026, 7, 2);
    const onSelect = vi.fn();
    render(
      <MiniCalendar
        selectedDate={selected}
        onSelect={onSelect}
        events={[calendarEvent('event-1', selected)]}
      />
    );
    const props = mocks.calendarProps[0];
    expect(props.modifiers.hasEvents(selected)).toBe(true);
    expect(props.modifiers.hasEvents(new Date(2026, 7, 3))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'calendar-control' }));
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 7, 3));
    props.onSelect(undefined);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('counts total, current-week, and current-month event statistics', () => {
    render(
      <CalendarStats
        events={[
          calendarEvent('today', new Date(2026, 7, 2, 13)),
          calendarEvent('this-month', new Date(2026, 7, 20)),
          calendarEvent('other-month', new Date(2026, 8, 2)),
        ]}
      />
    );
    expect(
      screen.getByText('features.calendar.stats.totalEvents').parentElement?.textContent
    ).toContain('3');
    expect(
      screen.getByText('features.calendar.stats.thisWeek').parentElement?.textContent
    ).toContain('1');
    expect(
      screen.getByText('features.calendar.stats.thisMonth').parentElement?.textContent
    ).toContain('2');
  });

  it('sorts a day agenda, calculates timing, strips recurrence IDs, and renders the empty branch', () => {
    const selected = new Date(2026, 7, 2);
    const later = calendarEvent('event-2', new Date(2026, 7, 2, 14));
    const earlier = calendarEvent('event-1_rrule_1', new Date(2026, 7, 2, 10));
    const { rerender } = render(
      <DayView
        selectedDate={selected}
        events={[later, earlier]}
        allEvents={[later, earlier]}
        onDateSelect={vi.fn()}
      />
    );
    expect(mocks.agendas.map(agenda => agenda.id)).toEqual(['event-1_rrule_1', 'event-2']);
    expect(mocks.agendas[0].detailsLink).toBe('/event/event-1');
    expect(mocks.timelines[0]).toMatchObject({ order: 1, duration: 90 });
    rerender(<DayView selectedDate={selected} events={[]} allEvents={[]} onDateSelect={vi.fn()} />);
    expect(screen.getByText('features.calendar.dayView.noEvents')).toBeTruthy();

    rerender(
      <DayView
        selectedDate={selected}
        events={[earlier]}
        allEvents={[earlier]}
        onDateSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/features.calendar.dayView.eventCount:/)).toBeTruthy();
  });

  it('renders month event variants, date modifiers, event actions, and no-event state', () => {
    const selected = new Date(2026, 7, 2);
    const onDateSelect = vi.fn();
    const onEventOpen = vi.fn();
    const events = [
      calendarEvent('event-1', selected),
      calendarEvent('meeting-1', selected, {
        isMeeting: true,
        location: '',
        visibility: 'private',
      }),
    ];
    const { rerender } = render(
      <MonthViewView
        selectedDate={selected}
        events={events}
        allEvents={events}
        onDateSelect={onDateSelect}
        onEventOpen={onEventOpen}
      />
    );
    expect(screen.getByText('event-1')).toBeTruthy();
    expect(screen.getByText(/meeting-1/)).toBeTruthy();
    expect(screen.getByText('features.calendar.eventCard.privateMeeting')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /event-1/ }));
    expect(onEventOpen).toHaveBeenCalledWith('event-1');
    const props = mocks.calendarProps.at(-1);
    expect(props.modifiers.hasEvents(selected)).toBe(true);
    props.onMonthChange(new Date(2026, 8, 1));
    expect(onDateSelect).toHaveBeenCalled();

    rerender(
      <MonthViewView
        selectedDate={new Date(2026, 7, 3)}
        events={events}
        allEvents={events}
        onDateSelect={onDateSelect}
        onEventOpen={onEventOpen}
      />
    );
    expect(screen.getByText('features.calendar.monthView.noEvents')).toBeTruthy();

    mocks.language = 'de';
    const publicMeeting = calendarEvent('public-meeting', selected, {
      isMeeting: true,
      visibility: 'public',
    });
    rerender(
      <MonthViewView
        selectedDate={selected}
        events={[publicMeeting]}
        allEvents={[publicMeeting]}
        onDateSelect={onDateSelect}
        onEventOpen={onEventOpen}
      />
    );
    const germanProps = mocks.calendarProps.at(-1);
    germanProps.onSelect(undefined);
    expect(onDateSelect).toHaveBeenCalledTimes(1);
    germanProps.onSelect(new Date(2026, 7, 4));
    expect(onDateSelect).toHaveBeenCalledTimes(2);
    expect(screen.getByText('features.calendar.eventCard.publicMeeting')).toBeTruthy();
  });

  it('opens week events and the MonthView controller navigates recurring instances to their base event', () => {
    const selected = new Date(2026, 7, 2);
    const event = calendarEvent('event-1_rrule_1', selected);
    const onEventOpen = vi.fn();
    const { unmount } = render(
      <WeekViewView
        selectedDate={selected}
        events={[event]}
        allEvents={[event]}
        onEventOpen={onEventOpen}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /event-1/ }));
    expect(onEventOpen).toHaveBeenCalledWith('event-1_rrule_1');
    unmount();

    mocks.language = 'de';
    render(
      <WeekViewView
        selectedDate={new Date(2026, 7, 3)}
        events={[
          calendarEvent('meeting-1', new Date(2026, 7, 2), { isMeeting: true }),
          calendarEvent('event-2', new Date(2026, 7, 3)),
        ]}
        allEvents={[
          calendarEvent('meeting-1', new Date(2026, 7, 2), { isMeeting: true }),
          calendarEvent('event-2', new Date(2026, 7, 3)),
        ]}
        onEventOpen={onEventOpen}
      />
    );
    expect(screen.getByText(/📅 meeting-1/)).toBeTruthy();
    expect(screen.getByText(/features.calendar.weekView.eventCountPlural/)).toBeTruthy();
    cleanup();
    render(
      <MonthView
        selectedDate={selected}
        events={[event]}
        allEvents={[event]}
        onDateSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /event-1/ }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/event/event-1' });
  });
});
