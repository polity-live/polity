/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user' } as { id: string } | null,
  events: null as any[] | null,
  navigate: vi.fn(),
  setSearchQuery: vi.fn(),
  setDateFilter: vi.fn(),
  bookingCount: vi.fn(() => 4),
  booked: vi.fn(() => true),
  generate: vi.fn((event: any) => event.instances ?? [event]),
  visible: vi.fn((_mode: string, events: any[]) =>
    events.map(event => ({ ...event, visible: true }))
  ),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useGroupEventsForCalendar: () => ({ events: mocks.events }),
}));
vi.mock('@/features/events/hooks/useCalendarView', () => ({
  useCalendarView: () => ({
    viewMode: 'week',
    filterEventsForRange: vi.fn(),
    calendarValue: 'calendar',
  }),
}));
vi.mock('@/features/events/hooks/useCalendarEventFilter', () => ({
  useCalendarEventFilter: (events: any[]) => ({
    filteredBySearch: events,
    searchQuery: 'query',
    setSearchQuery: mocks.setSearchQuery,
    dateFilter: 'all',
    setDateFilter: mocks.setDateFilter,
  }),
}));
vi.mock('@/features/calendar/logic/recurringEventHelpers', () => ({
  generateRecurringInstances: mocks.generate,
}));
vi.mock('@/features/calendar/logic/listViewHelpers', () => ({
  getCalendarEventsForView: mocks.visible,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'de' }),
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (junctions: any) => (junctions == null ? undefined : junctions),
}));
vi.mock('@/zero/events/useMeetingState', () => ({
  getInstanceBookingCount: mocks.bookingCount,
  isBookedByUser: mocks.booked,
}));
vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatNamedLocation: (name: string | null | undefined) => (name ? `location:${name}` : ''),
}));
vi.mock('@/features/create/logic/createEventSearch', () => ({
  toCreateEventSearch: (range: unknown) => ({ range }),
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (event: unknown) => event,
}));

import { useGroupEventsPage } from '../useGroupEventsPage';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user' };
  mocks.events = null;
});

describe('useGroupEventsPage', () => {
  it('returns an empty filtered calendar without event data and navigates from callbacks', () => {
    const { result } = renderHook(() => useGroupEventsPage('group'));
    expect(result.current.events).toEqual([]);
    expect(result.current.filteredEvents).toEqual([]);

    act(() => result.current.onEventSelect({ id: 'event' } as any));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/event/$id', params: { id: 'event' } });
    const range = { start: new Date(1), end: new Date(2) };
    act(() => result.current.onCreateEventRange(range));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/create/event',
      search: { range },
    });
  });

  it('skips bookable events and maps meeting and ordinary calendar fields', () => {
    mocks.events = [
      { id: 'bookable', is_bookable: true, tutorial_run_id: null },
      {
        id: 'ordinary',
        title: null,
        description: null,
        start_date: null,
        end_date: null,
        visibility: null,
        meeting_type: null,
        is_bookable: false,
        participants: undefined,
        creator: null,
        group: null,
        group_id: 'group',
        location_name: null,
        event_hashtags: null,
        tutorial_run_id: null,
        exceptions: undefined,
      },
      {
        id: 'meeting',
        title: 'Meeting',
        description: 'Description',
        start_date: 10,
        end_date: 20,
        visibility: 'private',
        meeting_type: 'video',
        is_bookable: false,
        participants: [{ user_id: 'user' }],
        creator_id: 'creator',
        creator: { id: 'creator', first_name: 'Ada', last_name: 'Lovelace', avatar: 'avatar' },
        group: { name: 'Group' },
        group_id: 'group',
        location_name: 'Room',
        event_hashtags: ['one', 'two'],
        tutorial_run_id: 'tutorial',
        exceptions: [],
        instances: [
          {
            id: 'meeting-instance',
            title: 'Instance',
            description: 'Instance description',
            start_date: 30,
            end_date: 40,
            visibility: 'authenticated',
            image_url: 'image',
            location_name: 'Instance Room',
            isRecurringInstance: true,
          },
        ],
      },
      {
        id: 'creator-fallback',
        title: '',
        description: '',
        start_date: 1,
        end_date: 2,
        visibility: 'public',
        meeting_type: null,
        is_bookable: false,
        participants: [],
        creator: { id: 'creator-2', first_name: null, last_name: null, avatar: null },
        group: null,
        group_id: 'group',
        location_name: null,
        event_hashtags: [],
      },
    ];
    const { result } = renderHook(() => useGroupEventsPage('group'));
    expect(result.current.events).toHaveLength(3);
    expect(result.current.events[0]).toMatchObject({
      id: 'ordinary',
      title: '',
      start_date: 0,
      end_date: 0,
      location: undefined,
      visibility: 'public',
      description: '',
      organizer: undefined,
      organizerName: undefined,
      attendeeCount: undefined,
      hashtags: undefined,
      isMeeting: false,
    });
    expect(result.current.events[1]).toMatchObject({
      id: 'meeting-instance',
      location: 'location:Instance Room',
      organizerName: 'Group',
      attendeeCount: 1,
      hashtags: [
        { id: 'one', tag: 'one' },
        { id: 'two', tag: 'two' },
      ],
      isMeeting: true,
      bookingCount: 4,
      isBookedByMe: true,
    });
    expect(result.current.events[2]).toMatchObject({
      organizer: { id: 'creator-2', name: undefined, avatar: undefined },
      organizerName: undefined,
    });
    expect(result.current.filteredEvents.every(event => (event as any).visible)).toBe(true);
    expect(mocks.bookingCount).toHaveBeenCalledWith([{ user_id: 'user' }], 'creator', 30);
    expect(mocks.booked).toHaveBeenCalledWith([{ user_id: 'user' }], 'user', 30);
  });

  it('maps nonrecurring meetings without a viewer or group name', () => {
    mocks.user = null;
    mocks.events = [
      {
        id: 'meeting',
        title: 'Meeting',
        description: 'Description',
        start_date: 10,
        end_date: 20,
        visibility: 'public',
        meeting_type: 'physical',
        is_bookable: false,
        participants: [],
        creator_id: 'creator',
        creator: { id: 'creator', first_name: 'Ada', last_name: '', avatar: null },
        group: null,
        group_id: 'group',
        location_name: 'Room',
        event_hashtags: [],
        isRecurringInstance: false,
      },
    ];
    const { result } = renderHook(() => useGroupEventsPage('group'));
    expect(result.current.events[0]).toMatchObject({
      organizerName: 'Ada',
      bookingCount: 4,
      isBookedByMe: undefined,
    });
    expect(mocks.bookingCount).toHaveBeenCalledWith([], 'creator', null);
    expect(mocks.booked).not.toHaveBeenCalled();
  });
});
