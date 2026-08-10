/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMeetingDetailPage } from '../useMeetingDetailPage';
import { useMeetingWeekViewController } from '../useMeetingWeekViewController';
import { useMeetPage } from '../useMeetPage';

const mocks = vi.hoisted(() => ({
  meetingData: {} as any,
  currentUser: { id: 'user-1' } as null | { id: string },
  meetings: [] as any[],
  isLoading: false,
  bookMeeting: vi.fn(),
  cancelMeetingBooking: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  cancelEvent: vi.fn(),
  navigate: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  recurringFields: { recurrence_pattern: null } as any,
}));

vi.mock('../useMeetingData', () => ({ useMeetingData: () => mocks.meetingData }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.currentUser }),
}));
vi.mock('@/zero/events', () => ({
  useMeetingsByCreator: () => ({ meetings: mocks.meetings, isLoading: mocks.isLoading }),
  getInstanceBookingCount: (participants: any[], creatorId: string) =>
    participants.filter(participant => participant.user_id !== creatorId).length,
  isBookedByUser: (participants: any[], userId: string) =>
    participants.some(participant => participant.user_id === userId),
}));
vi.mock('@/zero/events/useMeetingActions', () => ({
  useMeetingActions: () => ({
    bookMeeting: mocks.bookMeeting,
    cancelMeetingBooking: mocks.cancelMeetingBooking,
  }),
}));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    createEvent: mocks.createEvent,
    updateEvent: mocks.updateEvent,
    cancelEvent: mocks.cancelEvent,
  }),
}));
vi.mock('@/features/calendar/logic/recurringEventHelpers', () => ({
  generateRecurringInstances: (meeting: any) => [
    { ...meeting, isRecurringInstance: Boolean(meeting.testRecurringInstance) },
  ],
}));
vi.mock('@/features/events/logic/buildRecurringEventFields', () => ({
  buildRecurringEventFields: () => mocks.recurringFields,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser = { id: 'user-1' };
  mocks.meetings = [];
  mocks.isLoading = false;
  mocks.meetingData = { isLoading: true };
  mocks.recurringFields = { recurrence_pattern: null };
  for (const operation of [
    mocks.bookMeeting,
    mocks.cancelMeetingBooking,
    mocks.createEvent,
    mocks.updateEvent,
    mocks.cancelEvent,
  ])
    operation.mockResolvedValue(undefined);
});

function meeting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meeting-1',
    creator_id: 'user-1',
    creator: { id: 'user-1', first_name: 'Ada' },
    title: 'Office hours',
    description: 'Talk to Ada',
    meeting_type: 'public-meeting',
    start_date: new Date(2026, 7, 2, 10).getTime(),
    end_date: new Date(2026, 7, 2, 11).getTime(),
    is_bookable: true,
    max_bookings: 4,
    participants: [
      { id: 'creator', user_id: 'user-1', user: { id: 'user-1', first_name: 'Ada' } },
      {
        id: 'guest',
        user_id: 'user-2',
        status: 'active',
        user: { id: 'user-2', first_name: 'Grace', handle: 'grace' },
      },
    ],
    exceptions: [],
    ...overrides,
  };
}

describe('meeting page hooks', () => {
  it('separates loading, missing, and ready meeting detail state and preserves all actions', async () => {
    const loading = renderHook(() => useMeetingDetailPage('meeting-1'));
    expect(loading.result.current).toEqual({ state: 'loading' });
    loading.unmount();
    mocks.meetingData = { isLoading: false, event: null };
    const missing = renderHook(() => useMeetingDetailPage('meeting-1'));
    expect(missing.result.current).toEqual({ state: 'not-found' });
    missing.unmount();

    mocks.meetingData = {
      isLoading: false,
      event: meeting(),
      isAuthenticated: true,
      isOwner: true,
      hasBooked: false,
      bookingCount: 1,
      isPast: false,
      isAvailable: true,
    };
    const ready = renderHook(() => useMeetingDetailPage('meeting-1'));
    expect(ready.result.current).toMatchObject({
      state: 'ready',
      title: 'Office hours',
      isPublic: true,
      owner: { id: 'user-1', name: 'Ada' },
      participants: [{ id: 'guest', booker: { id: 'user-2', name: 'Grace', handle: 'grace' } }],
    });
    if (ready.result.current.state !== 'ready') throw new Error('Expected ready page');
    await act(async () => ready.result.current.onBook!());
    await act(async () => ready.result.current.onCancelBooking!());
    act(() => ready.result.current.onNavigateCalendar!());
    act(() => ready.result.current.onNavigateEdit!());
    expect(mocks.bookMeeting).toHaveBeenCalledWith('meeting-1');
    expect(mocks.cancelMeetingBooking).toHaveBeenCalledWith('meeting-1');
    expect(mocks.navigate.mock.calls).toEqual([
      [{ to: '/calendar' }],
      [{ to: '/event/meeting-1' }],
    ]);
  });

  it('builds week-grid markers, locale, and deterministic scroll restoration', () => {
    const { result, rerender } = renderHook(
      ({ date, language }) => useMeetingWeekViewController({ selectedDate: date, language }),
      { initialProps: { date: new Date(2026, 7, 2), language: 'de' } }
    );
    expect(result.current.weekDays).toHaveLength(7);
    expect(result.current.hourMarkers).toHaveLength(25);
    expect(result.current.halfHourMarkers).toHaveLength(24);
    expect(result.current.locale).toBe('de-DE');
    const container = document.createElement('div');
    result.current.containerRef.current = container;
    rerender({ date: new Date(2026, 7, 9), language: 'en' });
    expect(result.current.locale).toBe('en-US');
    expect(container.scrollTop).toBeGreaterThan(0);
  });

  it('expands and filters meetings and coordinates navigation, dialogs, booking, and owner mutations', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 7, 2, 8).getTime());
    mocks.meetings = [meeting()];
    const { result } = renderHook(() => useMeetPage('user-1'));
    expect(result.current).toMatchObject({
      isAuthenticated: true,
      isOwner: true,
      isLoading: false,
      view: 'list',
      currentViewTitle: 'features.meet.page.allOffers',
    });
    expect(result.current.allInstances).toHaveLength(1);
    const instance = result.current.allInstances[0];
    expect(instance).toMatchObject({
      parentEventId: 'meeting-1',
      bookingCount: 1,
      isBookedByMe: true,
    });
    act(() => result.current.openBookingDialog(instance));
    expect(result.current.isBookingDialogOpen).toBe(true);
    await act(async () => result.current.handleBookMeeting(instance));
    expect(mocks.bookMeeting).toHaveBeenCalledWith('meeting-1', null);
    expect(result.current.selectedInstance).toBeNull();
    await act(async () => result.current.handleCancelBooking(instance));
    expect(mocks.cancelMeetingBooking).toHaveBeenCalledWith('meeting-1', null);

    await act(async () =>
      result.current.handleCreateMeeting({
        title: ' New offer ',
        description: ' Description ',
        meetingType: 'one-on-one',
        startDate: new Date(2026, 7, 3, 10),
        durationMinutes: 90,
        maxBookings: 1,
        isRecurring: false,
        location: ' Office ',
      })
    );
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New offer',
        description: 'Description',
        visibility: 'private',
        meeting_type: 'one-on-one',
        creator_id: 'user-1',
      })
    );
    await act(async () => result.current.handleDeleteMeeting('meeting-1'));
    expect(mocks.cancelEvent).toHaveBeenCalledWith({
      id: 'meeting-1',
      cancel_reason: 'Deleted by owner',
    });
    await act(async () =>
      result.current.handleUpdateMeeting({
        id: 'meeting-1',
        title: ' Updated ',
        description: '',
        meetingType: 'public-meeting',
        startDate: new Date(2026, 7, 4, 10),
        durationMinutes: 60,
        maxBookings: 5,
      })
    );
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meeting-1', title: 'Updated', visibility: 'public' })
    );

    act(() => result.current.setView('week'));
    const before = result.current.selectedDate.getTime();
    act(() => result.current.goToNext());
    expect(result.current.selectedDate.getTime()).toBeGreaterThan(before);
    act(() => result.current.goToPrevious());
    expect(result.current.getInstancesForDate(new Date(2026, 7, 2))).toHaveLength(1);
    act(() => result.current.goToToday());
    expect(result.current.selectedDate.toDateString()).toBe(new Date().toDateString());
  });

  it('normalizes sparse recurring meetings and guards anonymous and non-owner mutations', async () => {
    mocks.currentUser = null;
    mocks.meetings = [
      meeting({
        creator_id: 'owner-2',
        creator: null,
        title: null,
        description: { type: 'doc' },
        meeting_type: null,
        start_date: null,
        end_date: null,
        max_bookings: null,
        participants: null,
        exceptions: null,
        location_name: null,
        location_url: null,
        stream_url: null,
        testRecurringInstance: true,
      }),
    ];
    const { result } = renderHook(() => useMeetPage('owner-2'));
    expect(result.current).toMatchObject({
      isAuthenticated: false,
      isOwner: false,
      owner: null,
    });
    expect(result.current.allInstances[0]).toMatchObject({
      title: 'common.entities.meeting',
      description: null,
      meetingType: null,
      startDate: 0,
      endDate: 0,
      maxBookings: 1,
      isBookedByMe: false,
      isRecurringInstance: true,
      instanceDate: null,
    });

    const sparse = result.current.allInstances[0];
    act(() => result.current.openBookingDialog(sparse));
    await act(async () => result.current.handleBookMeeting(sparse));
    await act(async () => result.current.handleCancelBooking(sparse));
    await act(async () =>
      result.current.handleCreateMeeting({
        title: 'Anonymous',
        description: '',
        meetingType: 'public-meeting',
        startDate: new Date(2026, 7, 3),
        durationMinutes: 30,
        maxBookings: 2,
        isRecurring: false,
      })
    );
    await act(async () => result.current.handleDeleteMeeting('meeting-1'));
    await act(async () =>
      result.current.handleUpdateMeeting({
        id: 'meeting-1',
        title: 'No owner',
        description: 'Ignored',
        meetingType: 'one-on-one',
        startDate: new Date(2026, 7, 3),
        durationMinutes: 30,
        maxBookings: 1,
        location: 'Room',
        locationUrl: 'https://example.test',
      })
    );
    expect(mocks.bookMeeting).not.toHaveBeenCalled();
    expect(mocks.cancelMeetingBooking).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.cancelEvent).not.toHaveBeenCalled();
    expect(mocks.updateEvent).not.toHaveBeenCalled();
  });

  it('sorts multiple meeting instances chronologically', () => {
    mocks.meetings = [
      meeting({ id: 'later', start_date: new Date(2026, 7, 3, 10).getTime() }),
      meeting({ id: 'earlier', start_date: new Date(2026, 7, 2, 10).getTime() }),
    ];
    const { result } = renderHook(() => useMeetPage('user-1'));
    expect(result.current.allInstances.map(instance => instance.parentEventId)).toEqual([
      'earlier',
      'later',
    ]);
  });

  it('covers list, month, and week navigation and public/private mutation payload fallbacks', async () => {
    mocks.meetings = [meeting()];
    const { result } = renderHook(() => useMeetPage('user-1'));
    const originalDate = result.current.selectedDate;

    act(() => result.current.goToPrevious());
    expect(result.current.selectedDate).toEqual(originalDate);
    act(() => result.current.goToNext());
    expect(result.current.selectedDate).toEqual(originalDate);

    act(() => result.current.setView('month'));
    expect(result.current.currentViewTitle).not.toBe('features.meet.page.allOffers');
    const month = result.current.selectedDate.getMonth();
    act(() => result.current.goToPrevious());
    expect(result.current.selectedDate.getMonth()).not.toBe(month);
    act(() => result.current.goToNext());
    expect(result.current.selectedDate.getMonth()).toBe(month);

    act(() => result.current.setView('week'));
    expect(result.current.currentViewTitle).not.toBe('features.meet.page.allOffers');

    await act(async () =>
      result.current.handleCreateMeeting({
        title: ' Public ',
        description: ' ',
        meetingType: 'public-meeting',
        startDate: new Date(2026, 7, 3, 10),
        durationMinutes: 30,
        maxBookings: 5,
        isRecurring: true,
        recurrence: { pattern: 'daily', interval: 1, weekdays: [], endDate: null },
        location: ' ',
        locationUrl: ' ',
      })
    );
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
        visibility: 'public',
        location_name: null,
        location_url: null,
      })
    );

    await act(async () =>
      result.current.handleUpdateMeeting({
        id: 'meeting-1',
        title: ' Private ',
        description: ' Details ',
        meetingType: 'one-on-one',
        startDate: new Date(2026, 7, 4, 10),
        durationMinutes: 45,
        maxBookings: 1,
        location: ' Office ',
        locationUrl: ' https://example.test ',
      })
    );
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Details',
        visibility: 'private',
        location_name: 'Office',
        location_url: 'https://example.test',
      })
    );
  });

  it('normalizes a sparse ready meeting detail view', () => {
    mocks.meetingData = {
      isLoading: false,
      event: meeting({
        creator_id: 'owner',
        creator: undefined,
        title: '',
        description: { type: 'doc' },
        meeting_type: undefined,
        start_date: undefined,
        end_date: undefined,
        participants: [
          {
            id: undefined,
            status: undefined,
            user: { id: 'guest', first_name: undefined, handle: undefined, avatar: undefined },
          },
          { id: 'anonymous', status: 'pending', user: undefined },
        ],
      }),
      isAuthenticated: false,
      isOwner: false,
      hasBooked: false,
      bookingCount: 0,
      isPast: true,
      isAvailable: false,
    };
    const { result } = renderHook(() => useMeetingDetailPage('meeting-1'));
    expect(result.current).toMatchObject({
      state: 'ready',
      title: 'common.entities.meeting',
      owner: { id: 'unknown', name: 'Unknown', avatar: undefined },
      meetingType: '',
      description: '',
      startTime: 0,
      endTime: 0,
      participants: [
        {
          id: '',
          status: '',
          booker: { id: 'guest', name: undefined, handle: undefined, avatar: undefined },
        },
        { id: 'anonymous', status: 'pending', booker: undefined },
      ],
    });

    mocks.meetingData = {
      ...mocks.meetingData,
      event: meeting({ participants: null }),
    };
    const withoutParticipants = renderHook(() => useMeetingDetailPage('meeting-1'));
    expect(withoutParticipants.result.current).toMatchObject({ participants: [] });
  });
});
