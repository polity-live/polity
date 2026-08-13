/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventFormData } from '../useEventUpdate';

const mocks = vi.hoisted(() => ({
  currentEvent: null as Record<string, any> | null,
  eventLoading: false,
  user: { id: 'user-1' } as { id: string } | null,
  eventHashtags: [] as Record<string, any>[],
  allHashtags: [] as Record<string, any>[],
  navigate: vi.fn(),
  createEvent: vi.fn(),
  updateEventAction: vi.fn(),
  updateEvent: vi.fn(),
  syncEntityHashtags: vi.fn(),
  waitForClientApply: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));

vi.mock('../useEventData', () => ({
  useEventData: () => ({ event: mocks.currentEvent, isLoading: mocks.eventLoading }),
}));

vi.mock('../useEventMutations', () => ({
  useEventMutations: () => ({ updateEvent: mocks.updateEvent }),
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    createEvent: mocks.createEvent,
    updateEvent: mocks.updateEventAction,
  }),
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({
    eventHashtags: mocks.eventHashtags,
    allHashtags: mocks.allHashtags,
  }),
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncEntityHashtags }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(...args),
}));

import { useEventUpdate } from '../useEventUpdate';

const richText = (text: string) => [{ type: 'p', children: [{ text }] }] as any;

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

function setFields(
  result: { current: ReturnType<typeof useEventUpdate> },
  values: Partial<EventFormData>
) {
  act(() => {
    result.current.setFormData(previous => ({ ...previous, ...values }));
  });
}

function completeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Assembly',
    description: richText('Existing description'),
    attendance_mode: 'hybrid',
    location_type: 'physical',
    location_name: 'Hall',
    location_url: 'https://meet.example.test/room',
    stream_url: 'https://video.example.test/watch',
    country: 'DE',
    region: 'BE',
    post_code: '10115',
    city: 'Berlin',
    street: 'Main Street',
    house_number: '1',
    latitude: 52.5,
    longitude: 13.4,
    location_kind: 'venue',
    location_place_id: 'place-1',
    location_boundary_source: 'manual',
    location_geometry: { type: 'Point' },
    location_bounds: [13, 52, 14, 53],
    start_date: Date.UTC(2026, 7, 10, 8, 30),
    end_date: Date.UTC(2026, 7, 10, 10, 0),
    capacity: 40,
    group_id: 'group-1',
    image_url: 'https://cdn.example.test/image.png',
    video_url: 'https://cdn.example.test/video.mp4',
    visibility: 'private',
    registration_deadline: Date.UTC(2026, 7, 9, 8, 0),
    amendment_deadline: Date.UTC(2026, 7, 8, 8, 0),
    candidacy_deadline: Date.UTC(2026, 7, 7, 8, 0),
    delegates_nomination_deadline: Date.UTC(2026, 7, 6, 8, 0),
    event_type: 'delegate_assembly',
    delegate_seat_allocation_type: 'fixed_total',
    total_delegate_seats: 12,
    main_group_delegate_allocation_mode: '8',
    delegate_election_mode: 'ranked',
    default_final_vote_duration_seconds: 600,
    gender_quota_enabled: true,
    accreditation_required: true,
    change_request_vote_order: 'after_discussion',
    is_recurring: true,
    recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T000000Z',
    recurrence_pattern: 'weekly',
    recurrence_interval: 2,
    recurrence_days: [3, 1],
    recurrence_end_date: Date.UTC(2026, 11, 31),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.currentEvent = null;
  mocks.eventLoading = false;
  mocks.user = { id: 'user-1' };
  mocks.eventHashtags = [];
  mocks.allHashtags = [];
  mocks.navigate.mockReset();
  mocks.createEvent.mockReset().mockReturnValue({ client: Promise.resolve() });
  mocks.updateEventAction.mockReset();
  mocks.updateEvent.mockReset().mockResolvedValue({ success: true });
  mocks.syncEntityHashtags.mockReset().mockResolvedValue(undefined);
  mocks.waitForClientApply.mockReset().mockResolvedValue(undefined);
  mocks.toastError.mockReset();
});

describe('useEventUpdate', () => {
  it('initializes complete recurring event data and merges hashtags only once', async () => {
    mocks.currentEvent = completeEvent();
    mocks.eventLoading = true;
    mocks.eventHashtags = [
      { hashtag: { tag: 'assembly' } },
      { hashtag: null },
      { hashtag: { tag: 'berlin' } },
    ];

    const { result, rerender } = renderHook(() => useEventUpdate('event-1'));

    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));
    await waitFor(() => expect(result.current.formData.tags).toEqual(['assembly', 'berlin']));
    expect(result.current).toMatchObject({ isCreating: false, isLoading: true });
    expect(result.current.formData).toMatchObject({
      attendanceMode: 'hybrid',
      locationName: 'Hall',
      onlineLink: 'https://meet.example.test/room',
      capacity: '40',
      groupId: 'group-1',
      visibility: 'private',
      delegateAllocationMode: 'total',
      delegateTotalSeats: '12',
      delegateMembersPerSeat: '8',
      defaultFinalVoteDurationMinutes: '10',
      genderQuotaEnabled: true,
      accreditationRequired: true,
      recurrencePattern: 'weekly',
      recurrenceInterval: 2,
      recurrenceWeekdays: [0, 2],
      tags: ['assembly', 'berlin'],
    });

    mocks.currentEvent = completeEvent({ title: 'Replacement' });
    mocks.eventHashtags = [{ hashtag: { tag: 'replacement' } }];
    rerender();
    expect(result.current.formData.title).toBe('Assembly');
    expect(result.current.formData.tags).toEqual(['assembly', 'berlin']);
  });

  it('falls back from malformed recurrence and absent optional event fields', async () => {
    mocks.currentEvent = completeEvent({
      title: null,
      description: null,
      attendance_mode: null,
      location_type: 'online',
      location_name: null,
      location_url: null,
      stream_url: null,
      country: null,
      region: null,
      post_code: null,
      city: null,
      street: null,
      house_number: null,
      latitude: null,
      longitude: null,
      location_kind: null,
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
      start_date: Date.UTC(2026, 7, 11, 8),
      end_date: null,
      capacity: null,
      group_id: null,
      image_url: null,
      video_url: null,
      visibility: null,
      registration_deadline: null,
      amendment_deadline: null,
      candidacy_deadline: null,
      delegates_nomination_deadline: null,
      delegate_seat_allocation_type: null,
      total_delegate_seats: null,
      main_group_delegate_allocation_mode: 'invalid',
      delegate_election_mode: null,
      default_final_vote_duration_seconds: null,
      gender_quota_enabled: null,
      accreditation_required: null,
      change_request_vote_order: null,
      recurrence_rule: 'not-an-rrule',
      recurrence_pattern: 'unsupported',
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
    });

    const { result } = renderHook(() => useEventUpdate('event-1'));
    await waitFor(() => expect(result.current.formData.attendanceMode).toBe('online'));

    expect(result.current.formData).toMatchObject({
      title: '',
      description: '',
      locationName: '',
      capacity: '',
      groupId: '',
      visibility: 'public',
      delegateAllocationMode: 'ratio',
      delegateTotalSeats: '',
      delegateMembersPerSeat: '10',
      defaultFinalVoteDurationMinutes: '',
      genderQuotaEnabled: false,
      accreditationRequired: false,
      recurrencePattern: 'none',
      recurrenceInterval: 1,
      recurrenceWeekdays: [],
      recurrenceEndDate: '',
    });
  });

  it('hydrates legacy recurrence arrays, inferred weekdays, non-recurring events, and catch sorting', async () => {
    mocks.currentEvent = completeEvent({
      attendance_mode: 'legacy',
      location_type: 'physical',
      recurrence_rule: null,
      recurrence_pattern: 'weekly',
      recurrence_days: [5, 1],
      recurrence_interval: 3,
    });
    const legacy = renderHook(() => useEventUpdate('legacy'));
    await waitFor(() => expect(legacy.result.current.formData.recurrenceInterval).toBe(3));
    expect(legacy.result.current.formData).toMatchObject({
      attendanceMode: 'offline',
      recurrencePattern: 'weekly',
      recurrenceWeekdays: [1, 5],
    });
    legacy.unmount();

    mocks.currentEvent = completeEvent({
      recurrence_rule: null,
      recurrence_pattern: 'weekly',
      recurrence_days: [],
      start_date: Date.UTC(2026, 7, 10),
    });
    const inferred = renderHook(() => useEventUpdate('inferred'));
    await waitFor(() => expect(inferred.result.current.formData.recurrenceWeekdays).toEqual([0]));
    inferred.unmount();

    mocks.currentEvent = completeEvent({
      recurrence_rule: null,
      recurrence_pattern: 'daily',
      recurrence_interval: null,
      recurrence_days: null,
    });
    const legacyDefaults = renderHook(() => useEventUpdate('legacy-defaults'));
    await waitFor(() =>
      expect(legacyDefaults.result.current.formData.recurrencePattern).toBe('daily')
    );
    expect(legacyDefaults.result.current.formData).toMatchObject({
      recurrenceInterval: 1,
      recurrenceWeekdays: [],
    });
    legacyDefaults.unmount();

    mocks.currentEvent = completeEvent({
      recurrence_rule: 'FREQ=DAILY;INTERVAL=1',
    });
    const ruleWithoutEnd = renderHook(() => useEventUpdate('rule-without-end'));
    await waitFor(() =>
      expect(ruleWithoutEnd.result.current.formData.recurrencePattern).toBe('daily')
    );
    expect(ruleWithoutEnd.result.current.formData.recurrenceEndDate).toBe('');
    ruleWithoutEnd.unmount();

    mocks.currentEvent = completeEvent({
      recurrence_rule: 'malformed',
      recurrence_pattern: 'weekly',
      recurrence_days: [6, 2],
      start_date: 0,
    });
    const caught = renderHook(() => useEventUpdate('caught'));
    await waitFor(() => expect(caught.result.current.formData.recurrenceWeekdays).toEqual([2, 6]));
    caught.unmount();

    mocks.currentEvent = completeEvent({ is_recurring: false, recurrence_rule: null });
    const ordinary = renderHook(() => useEventUpdate('ordinary'));
    await waitFor(() => expect(ordinary.result.current.formData.title).toBe('Assembly'));
    expect(ordinary.result.current.formData.recurrencePattern).toBe('none');
  });

  it('reports every submit precondition without mutating or navigating', async () => {
    const { result } = renderHook(() => useEventUpdate('new-event', 'create'));

    setFields(result, { streamUrl: 'javascript:alert(1)' });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenLastCalledWith('pages.create.event.streamUrlInvalid');

    setFields(result, { streamUrl: '', recurrencePattern: 'daily', startDate: '' });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenLastCalledWith(
      'features.events.editPage.timeSeries.validation.startDateRequired'
    );

    setFields(result, {
      recurrencePattern: 'weekly',
      startDate: '2026-08-10',
      recurrenceWeekdays: [],
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenLastCalledWith(
      'features.events.editPage.timeSeries.validation.weekdaysRequired'
    );

    setFields(result, {
      recurrencePattern: 'none',
      defaultFinalVoteDurationMinutes: '1.5',
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenLastCalledWith(
      'features.events.editPage.finalVoteDurationInvalid'
    );

    mocks.user = null;
    setFields(result, { defaultFinalVoteDurationMinutes: '' });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenLastCalledWith(
      'generated.inline.0477_you_must_be_logged_in_to_create_an_event_9cd6fe1e'
    );
    expect(result.current.isSubmitting).toBe(false);
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('creates an offline delegate assembly with normalized fields and hashtag synchronization', async () => {
    mocks.currentEvent = completeEvent();
    mocks.eventHashtags = [{ hashtag: { tag: 'old' } }];
    mocks.allHashtags = [{ id: 'hashtag-1', tag: 'old' }];
    const { result } = renderHook(() => useEventUpdate('new-event', 'create'));
    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));

    setFields(result, {
      title: ' New assembly ',
      description: 'Description',
      descriptionContent: richText('Description'),
      attendanceMode: 'offline',
      streamUrl: ' https://video.example.test/live ',
      startDate: '2026-08-20',
      startTime: '09:00',
      endDate: '2026-08-20',
      endTime: '10:30',
      capacity: '25',
      delegateAllocationMode: 'total',
      delegateTotalSeats: '0',
      defaultFinalVoteDurationMinutes: '2',
      recurrencePattern: 'none',
      tags: ['new'],
    });
    await act(() => result.current.handleSubmit(submitEvent()));

    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-event',
        attendance_mode: 'offline',
        location_type: 'physical',
        location_url: null,
        stream_url: 'https://video.example.test/live',
        capacity: 25,
        creator_id: 'user-1',
        has_delegates: true,
        delegate_seat_allocation_type: 'fixed_total',
        total_delegate_seats: 1,
        main_group_delegate_allocation_mode: null,
        default_final_vote_duration_seconds: 120,
        is_recurring: false,
      })
    );
    expect(mocks.syncEntityHashtags).toHaveBeenCalledWith(
      'event',
      'new-event',
      ['new'],
      mocks.eventHashtags,
      mocks.allHashtags
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/event/new-event' });
  });

  it('creates online and hybrid payloads with the correct location and delegate fallbacks', async () => {
    mocks.currentEvent = completeEvent({ event_type: 'conference' });
    const { result } = renderHook(() => useEventUpdate('new-event', 'create'));
    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));

    setFields(result, {
      description: '',
      attendanceMode: 'online',
      startDate: '2026-08-20',
      startTime: '',
      endDate: '',
      endTime: '',
      capacity: '',
      imageURL: '',
      videoURL: '',
      groupId: '',
      delegateAllocationMode: 'ratio',
      delegateMembersPerSeat: 'bad',
      defaultFinalVoteDurationMinutes: '',
      recurrencePattern: 'daily',
      recurrenceInterval: 2,
      recurrenceEndDate: '',
    });
    await act(() => result.current.handleSubmit(submitEvent()));

    expect(mocks.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: null,
        location_type: 'online',
        location_name: null,
        country: null,
        latitude: null,
        location_geometry: null,
        image_url: null,
        video_url: null,
        capacity: null,
        group_id: null,
        has_delegates: false,
        delegate_seat_allocation_type: null,
        total_delegate_seats: null,
        main_group_delegate_allocation_mode: null,
        delegate_election_mode: null,
        default_final_vote_duration_seconds: null,
        is_recurring: true,
      })
    );

    setFields(result, { attendanceMode: 'hybrid' });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attendance_mode: 'hybrid',
        location_type: 'physical',
        location_name: 'Hall',
        location_url: 'https://meet.example.test/room',
      })
    );
  });

  it('creates sparse offline delegate payloads across ratio and total allocation branches', async () => {
    mocks.currentEvent = completeEvent();
    mocks.eventHashtags = null as any;
    mocks.allHashtags = null as any;
    const { result } = renderHook(() => useEventUpdate('new-event', 'create'));
    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));

    setFields(result, {
      description: '',
      attendanceMode: 'offline',
      locationName: '',
      onlineLink: '',
      country: '',
      region: '',
      postCode: '',
      city: '',
      street: '',
      houseNumber: '',
      imageURL: '',
      videoURL: '',
      capacity: '',
      groupId: '',
      startDate: '2026-08-20',
      recurrencePattern: 'none',
      delegateAllocationMode: 'ratio',
      delegateMembersPerSeat: '3',
      defaultFinalVoteDurationMinutes: '1',
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: null,
        location_name: null,
        country: null,
        region: null,
        post_code: null,
        city: null,
        street: null,
        house_number: null,
        image_url: null,
        video_url: null,
        capacity: null,
        group_id: null,
        delegate_seat_allocation_type: 'members_per_delegate',
        main_group_delegate_allocation_mode: '3',
        default_final_vote_duration_seconds: 60,
      })
    );
    expect(mocks.syncEntityHashtags).toHaveBeenLastCalledWith(
      'event',
      'new-event',
      expect.any(Array),
      [],
      []
    );

    setFields(result, {
      delegateAllocationMode: 'ratio',
      delegateMembersPerSeat: '0',
      defaultFinalVoteDurationMinutes: '',
      attendanceMode: 'hybrid',
      onlineLink: '',
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ main_group_delegate_allocation_mode: '1' })
    );

    setFields(result, { delegateAllocationMode: 'total', delegateTotalSeats: '4' });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ total_delegate_seats: 4 })
    );
  });

  it('updates events, handles rejected updates and exceptions, and removes images only in edit mode', async () => {
    mocks.currentEvent = completeEvent({ event_type: 'conference' });
    const { result } = renderHook(() => useEventUpdate('event-1'));
    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));

    act(() => result.current.removeImage());
    expect(mocks.updateEventAction).toHaveBeenCalledWith({ id: 'event-1', image_url: null });

    act(() => result.current.updateField('attendanceMode', 'online'));
    act(() => result.current.updateDescriptionContent(richText('Changed')));
    mocks.updateEvent.mockResolvedValueOnce({ success: false });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.syncEntityHashtags).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();

    mocks.updateEvent.mockResolvedValueOnce({ success: true });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.updateEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'event-1',
        description: expect.anything(),
        attendance_mode: 'online',
        location_name: null,
        location_url: 'https://meet.example.test/room',
        has_delegates: false,
        delegate_seat_allocation_type: null,
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/event/event-1' });

    mocks.updateEvent.mockRejectedValueOnce(new Error('server failed'));
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(result.current.isSubmitting).toBe(false);
  });

  it('updates sparse offline delegate assemblies across total and ratio allocations', async () => {
    mocks.currentEvent = completeEvent();
    mocks.eventHashtags = null as any;
    mocks.allHashtags = null as any;
    const { result } = renderHook(() => useEventUpdate('event-1'));
    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));

    setFields(result, {
      description: '',
      attendanceMode: 'offline',
      locationName: '',
      onlineLink: '',
      country: '',
      region: '',
      postCode: '',
      city: '',
      street: '',
      houseNumber: '',
      imageURL: '',
      videoURL: '',
      capacity: '',
      groupId: '',
      delegateAllocationMode: 'total',
      delegateTotalSeats: '5',
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.updateEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: null,
        location_type: 'physical',
        location_name: null,
        location_url: null,
        country: null,
        region: null,
        post_code: null,
        city: null,
        street: null,
        house_number: null,
        image_url: null,
        video_url: null,
        capacity: null,
        group_id: null,
        delegate_seat_allocation_type: 'fixed_total',
        total_delegate_seats: 5,
      })
    );

    setFields(result, {
      delegateAllocationMode: 'ratio',
      delegateMembersPerSeat: '0',
      attendanceMode: 'hybrid',
      onlineLink: '',
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.updateEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        delegate_seat_allocation_type: 'members_per_delegate',
        main_group_delegate_allocation_mode: '1',
      })
    );

    setFields(result, { delegateAllocationMode: 'total', delegateTotalSeats: '' });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.updateEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ total_delegate_seats: 1 })
    );
  });

  it('catches create exceptions separately from update exceptions', async () => {
    mocks.currentEvent = completeEvent({ is_recurring: false });
    mocks.createEvent.mockImplementationOnce(() => {
      throw new Error('create failed');
    });
    const { result } = renderHook(() => useEventUpdate('new-event', 'create'));
    await waitFor(() => expect(result.current.formData.title).toBe('Assembly'));
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(result.current.isSubmitting).toBe(false);
  });

  it('guards missing edit data and makes create-mode image removal a no-op', async () => {
    const edit = renderHook(() => useEventUpdate('missing-event'));
    await act(() => edit.result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0478_no_event_data_to_update_e4627a29'
    );

    const create = renderHook(() => useEventUpdate('new-event', 'create'));
    act(() => create.result.current.removeImage());
    expect(mocks.updateEventAction).not.toHaveBeenCalled();
  });
});
