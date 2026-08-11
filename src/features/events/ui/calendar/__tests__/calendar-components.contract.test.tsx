/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calendar = vi.hoisted(() => ({
  exportProps: undefined as undefined | Record<string, any>,
  filterProps: undefined as undefined | Record<string, any>,
  headerProps: undefined as undefined | Record<string, any>,
  listProps: undefined as undefined | Record<string, any>,
  zeroListProps: undefined as undefined | Record<string, any>,
  downloadICalFile: vi.fn(),
}));

vi.mock('@/features/events/logic/icalExport', () => ({
  downloadICalFile: calendar.downloadICalFile,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/calendar', () => ({
  CalendarExportButton: (props: Record<string, any>) => {
    calendar.exportProps = props;
    return <button onClick={props.onExport}>Export calendar</button>;
  },
  CalendarFilterBar: (props: Record<string, any>) => {
    calendar.filterProps = props;
    return <output>Filter bar</output>;
  },
  CalendarHeader: (props: Record<string, any>) => {
    calendar.headerProps = props;
    return <output>Calendar header</output>;
  },
  CalendarChronologicalListView: (props: Record<string, any>) => {
    calendar.listProps = props;
    return props.items.length ? (
      <>
        {props.items.map((item: any) => (
          <div key={item.id}>{props.renderItem(item)}</div>
        ))}
      </>
    ) : (
      <p>{props.emptyText}</p>
    );
  },
}));
vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({ event, onSelect }: Record<string, any>) => (
    <button onClick={onSelect}>{`Event:${event.id}:${event.organizerName}`}</button>
  ),
}));
vi.mock('@/features/timeline/ui/cards/MeetupTimelineCard', () => ({
  MeetupTimelineCard: ({ meetup, onSelect }: Record<string, any>) => (
    <button onClick={onSelect}>{`Meetup:${meetup.id}:${meetup.onlineUrl}`}</button>
  ),
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: Record<string, any>) => {
    calendar.zeroListProps = props;
    return <output>Virtual calendar list</output>;
  },
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      calendarPage: vi.fn(args => ({ kind: 'page', args })),
      byId: vi.fn(args => ({ kind: 'single', args })),
    },
  },
}));
vi.mock('../SharedWeekView', () => ({
  SharedWeekView: () => <output>Week view</output>,
}));
vi.mock('../SharedMonthView', () => ({
  SharedMonthView: () => <output>Month view</output>,
}));

import { CalendarExportButton } from '../CalendarExportButton';
import { CalendarSearchFilter } from '../CalendarSearchFilter';
import { CalendarViewContainer } from '../CalendarViewContainer';
import { SharedCalendarHeader } from '../SharedCalendarHeader';
import { SharedListView } from '../SharedListView';

const ordinary = {
  id: 'event-1@2026-08-02',
  title: 'Assembly',
  description: 'Discuss plans',
  start_date: Date.UTC(2026, 7, 2, 10),
  end_date: '2026-08-02T12:00:00.000Z',
  location: 'Berlin',
  organizer: { id: 'ada', name: 'Ada' },
  groupName: 'Civic Lab',
  group_id: 'group-1',
  isMeeting: false,
  tutorial_run_id: 'tutorial-1',
} as any;
const meeting = {
  ...ordinary,
  id: 'meeting-1',
  title: 'Office hours',
  isMeeting: true,
  tutorial_run_id: null,
  location_url: 'https://meet.example.test',
} as any;

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  calendar.exportProps = undefined;
  calendar.filterProps = undefined;
  calendar.headerProps = undefined;
  calendar.listProps = undefined;
  calendar.zeroListProps = undefined;
});

describe('event calendar component contracts', () => {
  it('normalizes calendar events into an iCal download only when export is requested', () => {
    const fallback = {
      ...ordinary,
      id: 'fallback',
      description: undefined,
      location: undefined,
      organizer: undefined,
      start_date: '2026-08-03T10:00:00.000Z',
      end_date: Date.UTC(2026, 7, 3, 11),
    } as any;
    render(<CalendarExportButton events={[ordinary, fallback]} filename="polity.ics" />);
    expect(calendar.downloadICalFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export calendar' }));
    expect(calendar.downloadICalFile).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: ordinary.id,
          creator: { name: 'Ada' },
          location_name: 'Berlin',
          start_date: ordinary.start_date,
          end_date: Date.parse(ordinary.end_date),
        }),
        expect.objectContaining({
          id: 'fallback',
          creator: null,
          description: null,
          location_name: null,
          start_date: Date.parse('2026-08-03T10:00:00.000Z'),
          end_date: Date.UTC(2026, 7, 3, 11),
        }),
      ],
      'polity.ics'
    );
  });

  it('forwards filter and generic view-mode header contracts without rewriting callbacks', () => {
    const onSearchChange = vi.fn();
    const setViewMode = vi.fn();
    render(
      <>
        <CalendarSearchFilter
          searchQuery="assembly"
          onSearchChange={onSearchChange}
          dateFilter=""
          onDateFilterChange={vi.fn()}
        />
        <SharedCalendarHeader
          viewMode="month"
          setViewMode={setViewMode}
          currentViewTitle="August 2026"
          onPrevious={vi.fn()}
          onNext={vi.fn()}
          onToday={vi.fn()}
        />
      </>
    );
    expect(calendar.filterProps).toMatchObject({ searchQuery: 'assembly', onSearchChange });
    expect(calendar.headerProps).toMatchObject({ viewMode: 'month', setViewMode });
  });

  it('selects list, week, and month implementations with the correct event sets', () => {
    const props = {
      selectedDate: new Date(2026, 7, 2),
      events: [ordinary],
      allEvents: [ordinary, meeting],
      onDateSelect: vi.fn(),
      onEventSelect: vi.fn(),
    };
    const { rerender } = render(<CalendarViewContainer {...props} viewMode="list" />);
    expect(screen.getByText(/Event:event-1/)).toBeTruthy();
    rerender(<CalendarViewContainer {...props} viewMode="week" />);
    expect(screen.getByText('Week view')).toBeTruthy();
    rerender(<CalendarViewContainer {...props} viewMode="month" />);
    expect(screen.getByText('Month view')).toBeTruthy();
  });

  it('renders ordinary, meetup, tutorial, selection, and empty chronological list states', () => {
    const onEventSelect = vi.fn();
    const { rerender, container } = render(
      <SharedListView
        events={[ordinary, meeting]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={onEventSelect}
      />
    );
    expect(container.querySelector('[data-tutorial-anchor="tutorial-first-event"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Event:event-1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Meetup:meeting-1/ }));
    expect(onEventSelect).toHaveBeenNthCalledWith(1, ordinary);
    expect(onEventSelect).toHaveBeenNthCalledWith(2, meeting);
    expect(calendar.listProps!.getItemDate(ordinary)).toBe(ordinary.start_date);
    expect(calendar.listProps!.getItemKey(ordinary)).toBe(ordinary.id);

    const fallbackMeeting = {
      ...meeting,
      id: 'meeting-fallback',
      organizer: undefined,
      organizerName: 'Fallback organizer',
      location_url: null,
      stream_url: 'https://stream.example.test',
    } as any;
    rerender(
      <SharedListView
        events={[fallbackMeeting]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={onEventSelect}
      />
    );
    expect(
      screen.getByRole('button', {
        name: /Meetup:meeting-fallback:https:\/\/stream\.example\.test/,
      })
    ).toBeTruthy();

    rerender(
      <SharedListView
        events={[]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={onEventSelect}
      />
    );
    expect(screen.getByText('features.calendar.dayView.noEvents')).toBeTruthy();
  });

  it('builds deterministic virtual page and permalink queries and renders matching recurring rows', () => {
    render(
      <SharedListView
        events={[ordinary]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={vi.fn()}
        queryScope={{ groupId: 'group-1', query: 'assembly' }}
      />
    );
    const props = calendar.zeroListProps!;
    expect(props.historyKey).toBe('calendar-list-group-1');
    expect(props.getPageQuery({ limit: 20, start: null, dir: 'forward', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(props.getSingleQuery({ id: 'event-1', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(props.getPageQuery({ limit: 20, start: null, dir: 'forward', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(props.getSingleQuery({ id: 'event-1', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(props.getRowKey(ordinary)).toBe(ordinary.id);
    expect(props.toStartRow(ordinary)).toEqual({
      start_date: ordinary.start_date,
      id: ordinary.id,
    });

    const firstRecurring = { ...ordinary, id: 'event-1_rrule_1', start_date: 2 } as any;
    const secondRecurring = { ...ordinary, id: 'event-1_rrule_2', start_date: 1 } as any;
    cleanup();
    render(
      <SharedListView
        events={[firstRecurring, secondRecurring]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={vi.fn()}
        queryScope={{ groupId: 'group-1' }}
      />
    );
    const recurringProps = calendar.zeroListProps!;
    const { container } = render(recurringProps.renderRow({ ...ordinary, id: 'event-1' }, 20));
    expect(container.querySelector('[data-calendar-base-event="event-1"]')).toBeTruthy();
    expect(container.querySelector('[style*="--civic-load-index: 11"]')).toBeTruthy();
    expect(render(props.renderSkeleton()).container.querySelector('.h-64')).toBeTruthy();
    expect(
      render(props.renderEmpty()).getByText('features.calendar.dayView.noEvents')
    ).toBeTruthy();

    cleanup();
    const sparse = {
      ...ordinary,
      id: 'sparse',
      end_date: undefined,
      organizer: undefined,
      organizerName: 'Fallback organizer',
      groupName: undefined,
      group_id: undefined,
      location_url: null,
      stream_url: 'https://stream.example.test',
    } as any;
    render(
      <SharedListView
        events={[]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={vi.fn()}
        queryScope={{ creatorId: 'creator-1' }}
      />
    );
    const creatorProps = calendar.zeroListProps!;
    expect(creatorProps.historyKey).toBe('calendar-list-creator-1');
    expect(
      creatorProps.getPageQuery({ limit: 1, start: null, dir: 'forward', settled: false })
    ).toEqual(expect.objectContaining({ query: expect.anything() }));
    const sparseRender = render(creatorProps.renderRow(sparse, 0));
    expect(
      sparseRender.getByRole('button', { name: /Event:sparse:Fallback organizer/ })
    ).toBeTruthy();
    cleanup();

    render(
      <SharedListView
        events={[]}
        selectedDate={new Date(2026, 7, 2)}
        onEventSelect={vi.fn()}
        queryScope={{}}
      />
    );
    expect(calendar.zeroListProps!.historyKey).toBe('calendar-list-all');
  });
});
