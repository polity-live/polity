/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'en',
  meetups: [] as any[],
  calendarPage: vi.fn(),
  byId: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string, values?: Record<string, unknown>) =>
      values?.name ? `${key}:${values.name}` : values?.count ? `${key}:${values.count}` : key,
  }),
  translate: (key: string) => key,
}));

vi.mock('@/features/timeline/ui/cards/MeetupTimelineCard', () => ({
  MeetupTimelineCard: (props: any) => {
    mocks.meetups.push(props.meetup);
    return (
      <div data-testid={`meetup-${props.meetup.id}`}>
        <span>{props.meetup.organizerName ?? 'no-organizer'}</span>
        <span>{props.meetup.onlineUrl ?? 'no-online-url'}</span>
        <span>
          {props.meetup.participants.map((item: any) => item.name ?? 'anonymous').join(',')}
        </span>
        {props.onBook ? <button onClick={props.onBook}>book-card</button> : null}
        {props.onCancel ? <button onClick={props.onCancel}>cancel-card</button> : null}
        {props.onDelete ? <button onClick={props.onDelete}>delete-card</button> : null}
        {props.onSelect ? <button onClick={props.onSelect}>select-card</button> : null}
      </div>
    );
  },
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label }: any) => <div>{label}</div>,
}));
vi.mock('@/features/shared/ui/layout', () => ({
  StatsBar: ({ items }: any) => <div>stats:{items[0].value}</div>,
}));
vi.mock('@/features/shared/ui/wiki/InfoTabs.tsx', () => ({
  InfoTabs: () => <div>about-tabs</div>,
}));
vi.mock('../MeetingActions', () => ({
  MeetingActions: ({ onBook }: any) => <button onClick={onBook}>page-book</button>,
}));
vi.mock('../MeetingDetails', () => ({
  MeetingDetails: ({ meetingType }: any) => <div>details:{meetingType}</div>,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      calendarPage: (...args: unknown[]) => mocks.calendarPage(...args),
      byId: (...args: unknown[]) => mocks.byId(...args),
    },
  },
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: any) => {
    const forward = props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false });
    const settled = props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true });
    const one = props.getSingleQuery({ id: 'meeting-1', settled: false });
    const oneSettled = props.getSingleQuery({ id: 'meeting-1', settled: true });
    const row = { id: 'meeting-1', start_date: 1 };
    return (
      <div
        data-testid="zero-list"
        data-page-ttl={forward.options.ttl}
        data-settled-page-ttl={settled.options.ttl}
        data-one-ttl={one.options.ttl}
        data-settled-one-ttl={oneSettled.options.ttl}
        data-row-key={props.getRowKey(row)}
        data-start-row={JSON.stringify(props.toStartRow(row))}
      >
        {props.renderRow(row)}
        {props.renderSkeleton()}
        {props.renderEmpty()}
      </div>
    );
  },
}));

vi.mock('@/features/shared/ui/calendar', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CalendarChronologicalListView: (props: any) => (
    <div data-testid="chronological-list">
      {props.items.length
        ? props.items.map((item: any) => (
            <div
              key={props.getItemKey(item)}
              data-item-date={props.getItemDate(item)}
              data-item-key={props.getItemKey(item)}
            >
              {props.renderItem(item)}
            </div>
          ))
        : props.emptyText}
    </div>
  ),
}));

import type { MeetingInstance } from '../../hooks/useMeetPage';
import { MeetingListView, MeetingMonthView, MeetingWeekView } from '../MeetingCalendarViews';
import { MeetingHeader } from '../MeetingHeader';
import { MeetingInstanceCard } from '../MeetingInstanceCard';
import { MeetingPageView } from '../MeetingPageView';
import { MeetingParticipants } from '../MeetingParticipants';

function instance(overrides: Partial<MeetingInstance> = {}): MeetingInstance {
  return {
    id: 'instance-1',
    parentEventId: 'meeting-1',
    title: 'Office hours',
    description: null,
    meetingType: 'public-meeting',
    startDate: Date.UTC(2099, 0, 1, 9),
    endDate: Date.UTC(2099, 0, 1, 10),
    isBookable: true,
    maxBookings: 3,
    bookingCount: 1,
    isBookedByMe: false,
    isRecurringInstance: false,
    instanceDate: null,
    locationName: null,
    locationUrl: null,
    streamUrl: 'https://stream.example.test',
    participants: [],
    creator: { id: 'owner-1', first_name: 'Ada', last_name: 'Lovelace', avatar: null },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.language = 'en';
  mocks.meetups.length = 0;
  mocks.calendarPage.mockReset().mockReturnValue({ kind: 'page' });
  mocks.byId.mockReset().mockReturnValue({ kind: 'one' });
});

afterEach(() => cleanup());

describe('meeting presentational coverage', () => {
  it('renders both header visibility variants and owner fallbacks', () => {
    const { rerender } = render(
      <MeetingHeader
        title="Public office hours"
        isPublic
        owner={{ id: 'owner', name: 'alice', avatar: 'avatar.png' }}
        meetingType="public-meeting"
      />
    );
    expect(screen.getByText('features.meet.page.public')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText(/alice/)).toBeTruthy();

    rerender(
      <MeetingHeader
        title="Private office hours"
        isPublic={false}
        owner={{ id: 'owner' }}
        meetingType="one-on-one"
      />
    );
    expect(screen.getByText('features.meet.page.private')).toBeTruthy();
    expect(screen.getByText('O')).toBeTruthy();
    expect(screen.getByText(/features.meet.participants.unspecified/)).toBeTruthy();
  });

  it('filters instance participants and forwards every optional card action', () => {
    const onBook = vi.fn();
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const item = instance({
      participants: [
        { id: 'creator', user_id: 'owner-1', instance_date: null },
        {
          id: 'no-date',
          user_id: 'user-1',
          instance_date: null,
          user: { id: 'user-1', first_name: 'Grace', last_name: 'Hopper', avatar: 'grace.png' },
        },
        { id: 'zero-date', user_id: 'user-2', instance_date: 0, user: null },
        { id: 'other-date', user_id: 'user-3', instance_date: 123 },
      ],
    });
    const { rerender } = render(
      <MeetingInstanceCard
        instance={item}
        isOwner
        onBook={onBook}
        onCancel={onCancel}
        onDelete={onDelete}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText('book-card'));
    fireEvent.click(screen.getByText('cancel-card'));
    fireEvent.click(screen.getByText('delete-card'));
    fireEvent.click(screen.getByText('select-card'));
    expect(onBook).toHaveBeenCalledWith(item);
    expect(onCancel).toHaveBeenCalledWith(item);
    expect(onDelete).toHaveBeenCalledWith('meeting-1');
    expect(onSelect).toHaveBeenCalledWith(item);
    expect(mocks.meetups.at(-1)).toMatchObject({
      organizerName: 'Ada Lovelace',
      onlineUrl: 'https://stream.example.test',
      participants: [
        expect.objectContaining({ name: 'Grace Hopper', avatar: 'grace.png' }),
        expect.objectContaining({ name: undefined, avatar: undefined }),
      ],
    });

    rerender(
      <MeetingInstanceCard
        instance={instance({
          instanceDate: 123,
          locationUrl: 'https://meeting.example.test',
          creator: null,
          participants: [
            { id: 'match', user_id: 'user-1', instance_date: 123, user: { id: 'user-1' } },
            { id: 'mismatch', user_id: 'user-2', instance_date: 456 },
          ],
        })}
        isOwner={false}
      />
    );
    expect(screen.queryByText('book-card')).toBeNull();
    expect(mocks.meetups.at(-1)).toMatchObject({
      organizerName: undefined,
      onlineUrl: 'https://meeting.example.test',
      participants: [expect.objectContaining({ id: 'match' })],
    });
  });

  it('renders empty and populated participant variants', () => {
    const { rerender } = render(<MeetingParticipants bookings={[]} count={0} />);
    expect(document.body.textContent).toBe('');

    rerender(
      <MeetingParticipants
        count={2}
        bookings={[
          {
            id: 'full',
            status: 'confirmed',
            notes: 'Bring documents',
            booker: { id: 'u1', name: 'alice', handle: 'alice', avatar: 'alice.png' },
          },
          { id: 'fallback', status: 'pending' },
        ]}
      />
    );
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
    expect(screen.getByText('Bring documents')).toBeTruthy();
    expect(screen.getByText('@generated.inline.0025_unknown_50d8b4a9')).toBeTruthy();
  });

  it('renders loading, not-found, and both ready about branches', () => {
    const { rerender } = render(<MeetingPageView state="loading" />);
    expect(screen.getByText('features.meet.page.loadingMeeting')).toBeTruthy();

    rerender(<MeetingPageView state="not-found" />);
    expect(screen.getByText('features.meet.page.notFound')).toBeTruthy();

    const ready = {
      state: 'ready' as const,
      title: 'Ready meeting',
      isPublic: true,
      owner: { id: 'owner', name: 'Ada' },
      meetingType: 'public-meeting',
      bookingCount: 0,
      meetingId: 'meeting-1',
      description: '',
      isAuthenticated: true,
      isOwner: true,
      hasBooked: false,
      isAvailable: true,
      isPast: false,
      startTime: 1,
      endTime: 2,
      participants: [],
      onBook: vi.fn(),
      onCancelBooking: vi.fn(),
      onNavigateCalendar: vi.fn(),
      onNavigateEdit: vi.fn(),
    };
    rerender(<MeetingPageView {...ready} />);
    expect(screen.queryByText('about-tabs')).toBeNull();
    rerender(<MeetingPageView {...ready} about={{ type: 'doc', content: [] } as any} />);
    expect(screen.getByText('about-tabs')).toBeTruthy();
  });
});

describe('meeting calendar coverage', () => {
  it('runs local and virtualized list contracts with every settled state', () => {
    const item = instance();
    const { rerender } = render(
      <MeetingListView instances={[]} isOwner={false} selectedDate={new Date(2026, 7, 9)} />
    );
    expect(screen.getByTestId('chronological-list').textContent).toContain(
      'features.calendar.dayView.noEvents'
    );

    rerender(
      <MeetingListView instances={[item]} isOwner={false} selectedDate={new Date(2026, 7, 9)} />
    );
    expect(
      screen.getByTestId('chronological-list').querySelector('[data-item-key="instance-1"]')
    ).toBeTruthy();

    rerender(
      <MeetingListView
        instances={[item, instance({ id: 'later', startDate: item.startDate + 1 })]}
        isOwner
        selectedDate={new Date(2026, 7, 9)}
        creatorId="owner-1"
      />
    );
    const list = screen.getByTestId('zero-list');
    expect(list.getAttribute('data-page-ttl')).toBe('none');
    expect(list.getAttribute('data-settled-page-ttl')).toBe('5m');
    expect(list.getAttribute('data-one-ttl')).toBe('none');
    expect(list.getAttribute('data-settled-one-ttl')).toBe('5m');
    expect(mocks.calendarPage).toHaveBeenCalled();
    expect(mocks.byId).toHaveBeenCalledWith({ id: 'meeting-1' });
  });

  it('connects the week controller to the week view', () => {
    const onDateSelect = vi.fn();
    const onSelectInstance = vi.fn();
    render(
      <MeetingWeekView
        selectedDate={new Date(2026, 7, 9)}
        onDateSelect={onDateSelect}
        getInstancesForDate={() => []}
        onSelectInstance={onSelectInstance}
      />
    );
    expect(document.querySelector('[data-action-id="meet.week.day-header.select"]')).toBeTruthy();
  });

  it('renders complete and partial months with every compact-card state and interaction', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 12));
    mocks.language = 'de';
    const onDateSelect = vi.fn();
    const onSelect = vi.fn();
    const variants = [
      instance({ id: 'booked', title: 'Booked', isBookedByMe: true, locationName: 'Room' }),
      instance({ id: 'open', title: 'Open', isBookable: true, bookingCount: 0, maxBookings: 2 }),
      instance({
        id: 'full',
        title: 'Full',
        isBookable: true,
        bookingCount: 2,
        maxBookings: 2,
        locationName: null,
        locationUrl: 'https://online.example.test',
      }),
      instance({
        id: 'closed',
        title: 'Closed',
        isBookable: false,
        locationName: null,
        locationUrl: null,
        streamUrl: null,
        endDate: Date.UTC(2020, 0, 1),
      }),
    ];
    const getInstancesForDate = (date: Date) => (date.getDate() === 9 ? variants : []);
    const { rerender } = render(
      <MeetingMonthView
        selectedDate={new Date(2026, 7, 9)}
        onDateSelect={onDateSelect}
        getInstancesForDate={getInstancesForDate}
        onSelectInstance={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Booked' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Full' }), { key: ' ' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Closed' }), { key: 'Escape' });
    expect(onSelect).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getAllByRole('button', { name: /Sonntag/ })[0]);
    expect(onDateSelect).toHaveBeenCalled();

    mocks.language = 'en';
    rerender(
      <MeetingMonthView
        selectedDate={new Date(2026, 1, 1)}
        onDateSelect={onDateSelect}
        getInstancesForDate={() => [instance({ title: 'Static' })]}
      />
    );
    expect(screen.getAllByText('Sun').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Static').length).toBeGreaterThan(0);
  });
});
