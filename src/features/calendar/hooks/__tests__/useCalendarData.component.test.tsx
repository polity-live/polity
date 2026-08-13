/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  events: [] as Record<string, unknown>[],
  recurring: vi.fn(),
  bookingCount: vi.fn(),
  bookedByUser: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventsForCalendarWithExceptions: () => ({ events: mocks.events }),
}));

vi.mock('@/features/calendar/logic/recurringEventHelpers', () => ({
  generateRecurringInstances: mocks.recurring,
}));

vi.mock('@/features/calendar/logic/calendarEventVisibility', () => ({
  isCalendarEventVisibleToUser: (event: Record<string, unknown>) => event.visible !== false,
  isCalendarEventOwnedByUser: (event: Record<string, unknown>) => event.owner === true,
}));

vi.mock('@/zero/events/useMeetingState', () => ({
  getInstanceBookingCount: mocks.bookingCount,
  isBookedByUser: mocks.bookedByUser,
}));

vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatNamedLocation: (name: unknown) => (name === 'Room One' ? 'Room One, Berlin' : ''),
}));

import { useCalendarData } from '../useCalendarData';

beforeEach(() => {
  mocks.user = { id: 'user-1' };
  mocks.events = [];
  mocks.recurring.mockReset();
  mocks.recurring.mockImplementation(event => event.instances ?? []);
  mocks.bookingCount.mockReset();
  mocks.bookingCount.mockReturnValue(4);
  mocks.bookedByUser.mockReset();
  mocks.bookedByUser.mockReturnValue(true);
});

describe('useCalendarData', () => {
  it('returns no events for an unauthenticated user', () => {
    mocks.user = null;
    mocks.events = [{ id: 'event-1' }];
    expect(renderHook(() => useCalendarData()).result.current).toEqual({
      events: [],
      isLoading: false,
    });
    expect(mocks.recurring).not.toHaveBeenCalled();
  });

  it('filters invisible events and maps a recurring meeting with full display data', () => {
    mocks.events = [
      { id: 'hidden', visible: false },
      {
        id: 'meeting',
        visible: true,
        owner: true,
        meeting_type: 'bookable',
        creator_id: 'creator-1',
        creator: {
          id: 'creator-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          avatar: 'avatar.png',
        },
        participants: [{ id: 'participant-1' }],
        group: { name: 'Group One' },
        group_id: 'group-1',
        event_hashtags: [{ hashtag: { tag: 'democracy' } }],
        exceptions: [{ id: 'exception-1' }],
        location_url: 'https://fallback.example.org',
        stream_url: 'https://stream.example.org',
        is_bookable: true,
        max_bookings: 10,
        instances: [
          {
            id: 'meeting-instance',
            isRecurringInstance: true,
            title: 'Meeting title',
            start_date: 100,
            end_date: 200,
            location_name: 'Room One',
            location_url: 'https://instance.example.org',
            visibility: 'private',
            image_url: 'image.png',
            description: 'Description',
          },
        ],
      },
    ];

    const result = renderHook(() => useCalendarData()).result.current.events;

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'meeting-instance',
      title: 'Meeting title',
      start_date: 100,
      end_date: 200,
      location: 'Room One, Berlin',
      location_url: 'https://instance.example.org',
      visibility: 'private',
      description: 'Description',
      organizer: { id: 'creator-1', name: 'Ada Lovelace', avatar: 'avatar.png' },
      groupName: 'Group One',
      organizerName: 'Group One',
      attendeeCount: 1,
      hashtags: [{ id: 'democracy', tag: 'democracy' }],
      isMeeting: true,
      isOwner: true,
      bookingCount: 4,
      isBookedByMe: true,
      stream_url: 'https://stream.example.org',
    });
    expect(mocks.bookingCount).toHaveBeenCalledWith([{ id: 'participant-1' }], 'creator-1', 100);
    expect(mocks.bookedByUser).toHaveBeenCalledWith([{ id: 'participant-1' }], 'user-1', 100);
  });

  it('maps non-meeting fallback values without booking work', () => {
    mocks.events = [
      {
        id: 'plain',
        meeting_type: null,
        creator_id: 'creator-2',
        creator: { id: 'creator-2', first_name: 'Grace', last_name: null, avatar: null },
        participants: undefined,
        group: null,
        group_id: null,
        event_hashtags: undefined,
        location_url: 'https://fallback.example.org',
        stream_url: null,
        instances: [
          {
            id: 'plain-instance',
            isRecurringInstance: false,
            title: null,
            start_date: null,
            end_date: undefined,
            location_name: null,
            location_url: null,
            visibility: null,
            image_url: null,
            description: null,
          },
        ],
      },
      {
        id: 'anonymous-organizer',
        meeting_type: null,
        creator: undefined,
        participants: [],
        location_url: null,
        instances: [
          {
            id: 'anonymous-instance',
            isRecurringInstance: false,
            title: '',
            start_date: 0,
            end_date: 0,
            location_url: undefined,
            visibility: undefined,
            description: '',
          },
        ],
      },
    ];

    const result = renderHook(() => useCalendarData()).result.current.events;

    expect(result[0]).toMatchObject({
      title: '',
      start_date: 0,
      end_date: 0,
      location: undefined,
      location_url: 'https://fallback.example.org',
      visibility: 'public',
      description: '',
      organizer: { id: 'creator-2', name: 'Grace', avatar: undefined },
      organizerName: 'Grace',
      attendeeCount: undefined,
      hashtags: [],
      isMeeting: false,
      isOwner: false,
      bookingCount: undefined,
      isBookedByMe: undefined,
      stream_url: null,
    });
    expect(result[1]).toMatchObject({
      organizer: undefined,
      organizerName: undefined,
      location_url: null,
    });
    expect(mocks.bookingCount).not.toHaveBeenCalled();
    expect(mocks.bookedByUser).not.toHaveBeenCalled();
  });
});
