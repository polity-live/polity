/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReturnToSubmitTarget,
  parseInternalReturnTo,
  useCreateEventForm,
} from '../useCreateEventForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

const navigate = vi.fn();
const createFullEvent = vi.fn();
let searchParams: Record<string, string | undefined> = {};
let creatableGroupIds = new Set<string>();
let groupPermissionLoading = false;
let openProcessTasks: Record<string, any>[] = [];
let restoredDraft: { formState: Record<string, any> } | null = null;
let selectedGroupOverrides: Record<string, unknown> = {};
let selectedGroupExists = true;
const eventMocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  trackCreateFinalization: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => searchParams,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [openProcessTasks, { type: 'complete' }],
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-current' },
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    (
      ({
        'generated.inline.0030_public_61c9b2b1': 'public',
        'generated.inline.0031_authenticated_8fda38ce': 'authenticated',
        'generated.inline.0032_ratio_4b6339ba': 'ratio',
        'generated.inline.0034_list_38b62be4': 'list',
        'generated.inline.0035_online_2dbc2fd2': 'online',
        'generated.inline.0036_hybrid_e2ac482d': 'hybrid',
      }) as Record<string, string>
    )[key] ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../ui/inputs/CreateRichTextField', () => ({
  CreateRichTextField: () => null,
}));

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: () => null,
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({ createFullEvent }),
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({
    allHashtags: [],
    userHashtags: [],
  }),
  useCommonActions: () => ({
    syncEntityHashtags: vi.fn(),
  }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupById: (id?: string) => ({
    group:
      id && selectedGroupExists
        ? {
            id,
            name: id === 'group-allowed' ? 'Allowed Group' : 'Denied Group',
            group_type: 'base',
            has_hierarchy_children: false,
            ...selectedGroupOverrides,
          }
        : undefined,
  }),
}));

vi.mock('@/zero/rbac', () => ({
  useCreatableGroupIds: () => ({
    creatableGroupIds,
    isLoading: groupPermissionLoading,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    completeProcessTaskWithEvent: vi.fn(),
  }),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      openProcessTasksByGroup: (args: unknown) => ({ __query: 'openProcessTasksByGroup', args }),
    },
  },
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: () => [],
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: eventMocks.toastError,
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
  },
}));

vi.mock('../../logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => restoredDraft,
  trackCreateFinalization: eventMocks.trackCreateFinalization,
}));

function findField<TKind extends CreateFormFieldDescriptor['kind']>(
  fields: CreateFormFieldDescriptor[],
  key: string,
  kind: TKind
): Extract<CreateFormFieldDescriptor, { kind: TKind }> {
  const field = fields.find(candidate => candidate.key === key && candidate.kind === kind);
  if (!field) {
    throw new Error(`Field ${key} not found`);
  }
  return field as Extract<CreateFormFieldDescriptor, { kind: TKind }>;
}

function fillTitle(result: { current: ReturnType<typeof useCreateEventForm> }) {
  const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');
  act(() => {
    titleField.onValueChange('Open planning session');
  });
}

function fillDateTime(result: { current: ReturnType<typeof useCreateEventForm> }) {
  const timeSeriesStep = result.current.steps.find(
    step => step.label === 'pages.create.event.timeSeries.tabLabel'
  );
  const timeSeriesField = findField(timeSeriesStep?.fields ?? [], 'time-series', 'customComponent');
  const props = timeSeriesField.props as {
    onDateTimeChange: (field: string, value: string) => void;
  };

  act(() => {
    props.onDateTimeChange('startDate', '2026-07-01');
    props.onDateTimeChange('startTime', '10:00');
    props.onDateTimeChange('endDate', '2026-07-01');
    props.onDateTimeChange('endTime', '11:00');
  });
}

describe('useCreateEventForm', () => {
  beforeEach(() => {
    searchParams = {};
    creatableGroupIds = new Set();
    groupPermissionLoading = false;
    openProcessTasks = [];
    restoredDraft = null;
    selectedGroupOverrides = {};
    selectedGroupExists = true;
    eventMocks.toastError.mockClear();
    eventMocks.trackCreateFinalization.mockClear();
    navigate.mockClear();
    createFullEvent.mockReset();
    createFullEvent.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve(),
    });
    vi.stubGlobal('crypto', { randomUUID: () => 'event-1' });
  });

  it('shows the date/time requirement for an open event without a group', () => {
    const { result } = renderHook(() => useCreateEventForm());
    fillTitle(result);

    const timeSeriesStep = result.current.steps.find(
      step => step.label === 'pages.create.event.timeSeries.tabLabel'
    );

    expect(timeSeriesStep?.isValid()).toBe(false);
    expect(timeSeriesStep?.getInvalidReason?.()).toBe(
      'pages.create.event.timeSeries.validation.dateTimeRangeRequired'
    );

    fillDateTime(result);

    expect(result.current.steps.at(-1)?.isValid()).toBe(true);
  });

  it('requires an associated group for assemblies', () => {
    const { result } = renderHook(() => useCreateEventForm());
    const eventTypeField = findField(
      result.current.steps[1].fields ?? [],
      'event-type',
      'customComponent'
    );

    act(() => {
      (eventTypeField.props as { onChange: (value: string) => void }).onChange('general_assembly');
    });

    const groupStep = result.current.steps.find(
      step => step.label === 'pages.create.event.associatedGroup'
    );

    expect(groupStep?.isValid()).toBe(false);
    expect(groupStep?.getInvalidReason?.()).toBe(
      'pages.create.event.validation.groupRequiredForAssembly'
    );
  });

  it('blocks an unauthorized prefilled group before submit', () => {
    searchParams = { groupId: 'group-denied' };

    const { result } = renderHook(() => useCreateEventForm());
    const groupStep = result.current.steps.find(
      step => step.label === 'pages.create.event.associatedGroup'
    );

    expect(groupStep?.isValid()).toBe(false);
    expect(groupStep?.getInvalidReason?.()).toBe(
      'pages.create.event.validation.groupPermissionDenied'
    );
  });

  it('normalizes and persists a protocol-less livestream link', async () => {
    const { result } = renderHook(() => useCreateEventForm());
    fillTitle(result);
    fillDateTime(result);

    const locationStep = result.current.steps.find(
      step => step.label === 'pages.create.event.location'
    );
    const locationField = findField(locationStep?.fields ?? [], 'location', 'customComponent');
    act(() => {
      (
        locationField.props as { onValueChange: (field: string, value: string) => void }
      ).onValueChange('streamUrl', ' twitch.tv/polity_live ');
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(createFullEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ stream_url: 'https://twitch.tv/polity_live' }),
      }),
      { notificationMode: 'silent' }
    );
  });

  it('parses internal, same-origin, external, relative, and malformed return targets', () => {
    expect(parseInternalReturnTo('/groups?tab=events#next')).toEqual({
      to: '/groups',
      search: { tab: 'events' },
      hash: 'next',
    });
    expect(parseInternalReturnTo(`${window.location.origin}/events`)).toEqual({
      to: '/events',
      search: undefined,
      hash: undefined,
    });
    expect(parseInternalReturnTo('https://example.com/events')).toBeNull();
    expect(parseInternalReturnTo('events')).toBeNull();
    expect(parseInternalReturnTo('http://[invalid')).toBeNull();

    expect(createReturnToSubmitTarget('/groups?tab=events#next', 'Back')).toMatchObject({
      kind: 'route',
      to: '/groups',
      search: { tab: 'events' },
      hash: 'next',
    });
    expect(createReturnToSubmitTarget('https://example.com/events', 'Back')).toMatchObject({
      kind: 'external',
      href: 'https://example.com/events',
    });

    const browserWindow = window;
    vi.stubGlobal('window', undefined);
    expect(parseInternalReturnTo('https://polity.local/events')).toEqual({
      to: '/events',
      search: undefined,
      hash: undefined,
    });
    vi.stubGlobal('window', browserWindow);
  });

  it('restores a complete delegate-assembly draft and exposes every conditional review section', () => {
    searchParams = { groupId: 'group-allowed' };
    creatableGroupIds = new Set(['group-allowed']);
    selectedGroupOverrides = { has_hierarchy_children: true };
    restoredDraft = {
      formState: {
        eventType: 'delegate_assembly',
        meetingType: 'public-meeting',
        meetingMaxBookings: '25',
        groupId: 'group-allowed',
        groupName: 'Draft Group',
        delegateConfig: { allocationMode: 'total', totalDelegates: 7, delegateRatio: 3 },
        delegateElectionMode: 'single',
        title: 'Delegates 2026',
        description: 'Delegate description',
        descriptionContent: [{ type: 'p', children: [{ text: 'Delegate description' }] }],
        startDate: '2026-08-01',
        startTime: '10:00',
        endDate: '2026-08-01',
        endTime: '12:00',
        attendanceMode: 'hybrid',
        locationName: 'Hall',
        onlineLink: 'https://meet.example.test',
        streamUrl: 'https://video.example.test/live',
        country: 'DE',
        region: 'BE',
        postCode: '10115',
        city: 'Berlin',
        street: 'Main',
        houseNumber: '1',
        latitude: 52.5,
        longitude: 13.4,
        locationShape: { kind: 'point', placeId: 'place-1' },
        capacity: '50',
        imageURL: 'https://img.example.test/a.jpg',
        videoURL: 'https://video.example.test/a.mp4',
        visibility: 'authenticated',
        genderQuotaEnabled: true,
        changeRequestVoteOrder: 'oldest_first',
        hashtags: ['democracy'],
        delegatesNominationDeadline: '2026-07-20T10:00',
        amendmentDeadline: '2026-07-25T10:00',
        recurrencePattern: 'weekly',
        recurrenceInterval: 2,
        recurrenceWeekdays: [1, 3],
        recurrenceEndDate: '2026-10-01',
      },
    };

    const { result } = renderHook(() => useCreateEventForm());

    expect(findField(result.current.steps[0].fields ?? [], 'title', 'text').value).toBe(
      'Delegates 2026'
    );
    expect(
      result.current.steps.some(step => step.label === 'pages.create.event.delegateAllocation')
    ).toBe(true);
    const review = findField(
      result.current.steps.at(-1)?.fields ?? [],
      'review',
      'customComponent'
    );
    const reviewProps = review.props as { hashtags?: string[]; media?: unknown; sections: any[] };
    expect(reviewProps.hashtags).toEqual(['democracy']);
    expect(reviewProps.sections.flatMap(section => section.fields).length).toBeGreaterThan(10);
    expect(result.current.steps.at(-1)?.isValid()).toBe(true);
  });

  it('restores an empty draft with every documented form default', () => {
    restoredDraft = { formState: {} };
    const { result } = renderHook(() => useCreateEventForm());

    expect(findField(result.current.steps[0].fields ?? [], 'title', 'text').value).toBe('');
    expect(
      (
        findField(result.current.steps[1].fields ?? [], 'event-type', 'customComponent')
          .props as any
      ).value
    ).toBe('open');
    const locationStep = result.current.steps.find(
      step => step.label === 'pages.create.event.location'
    );
    expect(
      (findField(locationStep?.fields ?? [], 'location', 'customComponent').props as any)
        .attendanceMode
    ).toBe('offline');
  });

  it('clears a stale restored group label when no group is selected', () => {
    restoredDraft = { formState: { groupId: '', groupName: 'Stale group' } };
    const { result } = renderHook(() => useCreateEventForm());
    const groupStep = result.current.steps.find(
      step => step.label === 'pages.create.event.associatedGroup'
    );
    expect(findField(groupStep?.fields ?? [], 'group', 'typeahead').props.value).toBeUndefined();
  });

  it('drives meeting, group, recurrence, location, settings, and media callbacks into one payload', async () => {
    creatableGroupIds = new Set(['group-allowed']);
    const reportProgress = vi.fn();
    const { result } = renderHook(() => useCreateEventForm());

    const basicFields = result.current.steps[0].fields ?? [];
    act(() => {
      findField(basicFields, 'title', 'text').onValueChange('  Public consultation  ');
      (findField(basicFields, 'description', 'customComponent').props as any).onChange([
        { type: 'p', children: [{ text: 'Details' }] },
      ]);
      (findField(basicFields, 'media', 'customComponent').props as any).onImageChange('image.jpg');
      (findField(basicFields, 'media', 'customComponent').props as any).onVideoChange('video.mp4');
      (
        findField(result.current.steps[1].fields ?? [], 'event-type', 'customComponent')
          .props as any
      ).onChange('meeting');
    });

    const meetingStep = result.current.steps.find(
      step => step.label === 'pages.create.event.meetingSettings'
    );
    act(() => {
      const props = (findField(meetingStep?.fields ?? [], 'meeting-settings', 'customComponent')
        .props ?? {}) as any;
      props.onMeetingTypeChange('public-meeting');
      props.onMeetingMaxBookingsChange('0');
    });

    const groupStep = result.current.steps.find(
      step => step.label === 'pages.create.event.associatedGroup'
    );
    const groupField = findField(groupStep?.fields ?? [], 'group', 'typeahead');
    expect((groupField.props as any).filterFn({ id: 'group-allowed' })).toBe(true);
    expect((groupField.props as any).filterFn({ id: 'group-denied' })).toBe(false);
    act(() => {
      (groupField.props as any).onChange(null);
      (groupField.props as any).onChange({ id: 'group-allowed', label: 'Allowed Group' });
    });

    const timeStep = result.current.steps.find(
      step => step.label === 'pages.create.event.timeSeries.tabLabel'
    );
    const timeProps = findField(timeStep?.fields ?? [], 'time-series', 'customComponent')
      .props as any;
    act(() => {
      timeProps.onDateTimeChange('startDate', '2026-08-02');
      timeProps.onDateTimeChange('startTime', '09:00');
      timeProps.onDateTimeChange('endDate', '2026-08-02');
      timeProps.onDateTimeChange('endTime', '10:00');
      timeProps.onRecurrencePatternChange('weekly');
      timeProps.onRecurrenceIntervalChange(2);
      timeProps.onRecurrenceWeekdaysChange([2]);
      timeProps.onRecurrenceEndDateChange('2026-09-01');
    });

    const locationStep = result.current.steps.find(
      step => step.label === 'pages.create.event.location'
    );
    const locationProps = findField(locationStep?.fields ?? [], 'location', 'customComponent')
      .props as any;
    act(() => {
      locationProps.onAttendanceModeChange('hybrid');
      for (const [field, value] of [
        ['locationName', 'Town Hall'],
        ['onlineLink', 'https://meet.example.test'],
        ['streamUrl', 'https://stream.example.test/live'],
        ['country', 'DE'],
        ['region', 'BE'],
        ['postCode', '10115'],
        ['city', 'Berlin'],
        ['street', 'Main'],
        ['houseNumber', '1'],
        ['latitude', 52.5],
        ['longitude', 13.4],
        ['capacity', '80'],
      ] as const) {
        locationProps.onValueChange(
          field,
          field === 'latitude' || field === 'longitude' ? 'x' : null
        );
        locationProps.onValueChange(field, value);
      }
      locationProps.onShapeChange({ kind: 'point', placeId: 'place-1' });
    });

    const settingsStep = result.current.steps.find(
      step => step.label === 'pages.create.event.settings'
    );
    const settingsProps = findField(settingsStep?.fields ?? [], 'settings', 'customComponent')
      .props as any;
    act(() => {
      settingsProps.onVisibilityChange('private');
      settingsProps.onGenderQuotaEnabledChange(true);
      settingsProps.onChangeRequestVoteOrderChange('newest_first');
      settingsProps.onHashtagsChange(['civic']);
    });

    await act(async () => {
      await result.current.onSubmit?.({ reportProgress } as any);
    });

    expect(createFullEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          title: 'Public consultation',
          meeting_type: 'public-meeting',
          max_bookings: 1,
          attendance_mode: 'hybrid',
          location_name: 'Town Hall',
          location_url: 'https://meet.example.test',
          image_url: 'image.jpg',
          video_url: 'video.mp4',
          visibility: 'public',
        }),
        hashtags: ['civic'],
      }),
      { notificationMode: 'silent' }
    );
    expect(reportProgress).toHaveBeenCalledTimes(5);
    expect(eventMocks.trackCreateFinalization).toHaveBeenCalledTimes(1);
  });

  it('clears a stale group label and tolerates an unresolved selected group', () => {
    creatableGroupIds = new Set(['group-allowed']);
    const hook = renderHook(() => useCreateEventForm());
    const groupStep = () =>
      hook.result.current.steps.find(step => step.label === 'pages.create.event.associatedGroup');
    act(() =>
      (findField(groupStep()?.fields ?? [], 'group', 'typeahead').props as any).onChange({
        id: 'group-allowed',
        label: 'Temporary label',
      })
    );
    act(() =>
      (findField(groupStep()?.fields ?? [], 'group', 'typeahead').props as any).onChange(null)
    );

    selectedGroupExists = false;
    searchParams = { groupId: 'group-allowed' };
    hook.rerender();
    expect(groupStep()?.isValid()).toBe(true);
  });

  it('blocks blank, invalid-stream, pending-group, ineligible-delegate, and missing-time submits', async () => {
    const blank = renderHook(() => useCreateEventForm());
    await act(async () => {
      expect(await blank.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
    blank.unmount();

    const invalidStream = renderHook(() => useCreateEventForm());
    fillTitle(invalidStream.result);
    fillDateTime(invalidStream.result);
    const invalidLocation = invalidStream.result.current.steps.find(
      step => step.label === 'pages.create.event.location'
    );
    act(() =>
      (
        findField(invalidLocation?.fields ?? [], 'location', 'customComponent').props as any
      ).onValueChange('streamUrl', 'http://[invalid')
    );
    expect(
      invalidStream.result.current.steps
        .find(step => step.label === 'pages.create.event.location')
        ?.getInvalidReason?.()
    ).not.toBeNull();
    await act(async () => {
      expect(await invalidStream.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
    invalidStream.unmount();

    searchParams = { groupId: 'group-allowed' };
    groupPermissionLoading = true;
    const pendingGroup = renderHook(() => useCreateEventForm());
    fillTitle(pendingGroup.result);
    fillDateTime(pendingGroup.result);
    expect(
      pendingGroup.result.current.steps
        .find(step => step.label === 'pages.create.event.associatedGroup')
        ?.getInvalidReason?.()
    ).toBe('pages.create.event.validation.groupPermissionPending');
    expect(pendingGroup.result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.event.validation.groupPermissionPending'
    );
    await act(async () => {
      expect(await pendingGroup.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
    pendingGroup.unmount();

    groupPermissionLoading = false;
    creatableGroupIds = new Set(['group-allowed']);
    const invalidDelegate = renderHook(() => useCreateEventForm());
    fillTitle(invalidDelegate.result);
    fillDateTime(invalidDelegate.result);
    act(() =>
      (
        findField(
          invalidDelegate.result.current.steps[1].fields ?? [],
          'event-type',
          'customComponent'
        ).props as any
      ).onChange('delegate_assembly')
    );
    await act(async () => {
      expect(await invalidDelegate.result.current.onSubmit?.()).toMatchObject({
        status: 'blocked',
      });
    });
    invalidDelegate.unmount();

    searchParams = {};
    const missingTime = renderHook(() => useCreateEventForm());
    fillTitle(missingTime.result);
    await act(async () => {
      expect(await missingTime.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });

    expect(eventMocks.toastError).toHaveBeenCalledWith('pages.create.event.streamUrlInvalid');
    expect(eventMocks.toastError).toHaveBeenCalledWith(
      'pages.create.event.timeSeries.validation.dateTimeRangeRequired'
    );
  });

  it('blocks weekly recurrence without weekdays and a start outside the process window', async () => {
    searchParams = {
      minStartDate: '2026-08-10',
      minStartTime: '10:00',
      maxStartDate: '2026-08-20',
      maxStartTime: '10:00',
    };
    const weekly = renderHook(() => useCreateEventForm());
    fillTitle(weekly.result);
    const timeStep = weekly.result.current.steps.find(
      step => step.label === 'pages.create.event.timeSeries.tabLabel'
    );
    const props = findField(timeStep?.fields ?? [], 'time-series', 'customComponent').props as any;
    act(() => {
      props.onDateTimeChange('startDate', '2026-08-11');
      props.onDateTimeChange('startTime', '10:00');
      props.onDateTimeChange('endDate', '2026-08-11');
      props.onDateTimeChange('endTime', '11:00');
      props.onRecurrencePatternChange('weekly');
      props.onDateTimeChange('ignored', 'ignored');
    });
    expect(
      weekly.result.current.steps
        .find(step => step.label === 'pages.create.event.timeSeries.tabLabel')
        ?.getInvalidReason?.()
    ).toBe('pages.create.event.timeSeries.validation.weekdaysRequired');
    expect(weekly.result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.event.timeSeries.validation.weekdaysRequired'
    );
    await act(async () => {
      expect(await weekly.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });

    act(() => {
      props.onRecurrenceWeekdaysChange([1]);
      props.onDateTimeChange('startDate', '2026-08-01');
      props.onDateTimeChange('endDate', '2026-08-01');
    });
    expect(weekly.result.current.steps.at(-1)?.getInvalidReason?.()).not.toBeNull();
    await act(async () => {
      expect(await weekly.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
  });

  it.each([
    ['total', { allocationMode: 'total', totalDelegates: 4, delegateRatio: 2 }],
    ['ratio', { allocationMode: 'ratio', totalDelegates: 4, delegateRatio: 0 }],
  ] as const)(
    'submits an eligible delegate assembly with %s allocation',
    async (_label, config) => {
      searchParams = { groupId: 'group-allowed' };
      creatableGroupIds = new Set(['group-allowed']);
      selectedGroupOverrides = { has_hierarchy_children: true };
      const { result } = renderHook(() => useCreateEventForm());
      fillTitle(result);
      fillDateTime(result);
      act(() =>
        (
          findField(result.current.steps[1].fields ?? [], 'event-type', 'customComponent')
            .props as any
        ).onChange('delegate_assembly')
      );
      const allocationStep = result.current.steps.find(
        step => step.label === 'pages.create.event.delegateAllocation'
      );
      const allocationProps = findField(
        allocationStep?.fields ?? [],
        'delegate-allocation',
        'customComponent'
      ).props as any;
      act(() => {
        allocationProps.onDelegateConfigChange(config);
        allocationProps.onDelegateElectionModeChange('single');
      });
      const timeStep = result.current.steps.find(
        step => step.label === 'pages.create.event.timeSeries.tabLabel'
      );
      const deadlines = (
        findField(timeStep?.fields ?? [], 'time-series', 'customComponent').props as any
      ).deadlines;
      act(() => deadlines.forEach((deadline: any) => deadline.onChange('2026-06-01T10:00')));

      await act(async () => {
        await result.current.onSubmit?.();
      });
      const event = createFullEvent.mock.calls.at(-1)?.[0]?.event;
      expect(event).toMatchObject({
        event_type: 'delegate_assembly',
        has_delegates: true,
        delegate_election_mode: 'single',
      });
      expect(event.delegate_seat_allocation_type).toBe(
        config.allocationMode === 'total' ? 'fixed_total' : 'members_per_delegate'
      );
      expect(event.total_delegate_seats).toBe(config.allocationMode === 'total' ? 4 : null);
      expect(event.main_group_delegate_allocation_mode).toBe(
        config.allocationMode === 'ratio' ? '1' : null
      );
    }
  );

  it('submits an online private event and auto-links eligible process tasks once', async () => {
    searchParams = {
      groupId: 'group-allowed',
      processTaskId: 'direct',
      returnTo: '/amendments?tab=process#task',
    };
    creatableGroupIds = new Set(['group-allowed']);
    openProcessTasks = [
      { id: 'closed', status: 'complete', task_type: 'schedule_event' },
      { id: 'direct', status: 'open', task_type: 'other', description: 'Direct link' },
      { id: 'other', status: 'open', task_type: 'other' },
      { id: 'duplicate', status: 'open', task_type: 'schedule_event', description: '  ' },
      { id: 'duplicate', status: 'open', task_type: 'schedule_event' },
      { id: 'described', status: 'open', task_type: 'schedule_event', description: 'Keep this' },
      {
        id: 'outside',
        status: 'open',
        task_type: 'schedule_event',
        metadata: { requiredAfter: Date.UTC(2035, 0, 1) },
      },
    ];
    const { result } = renderHook(() => useCreateEventForm());
    fillTitle(result);
    fillDateTime(result);
    const locationStep = result.current.steps.find(
      step => step.label === 'pages.create.event.location'
    );
    const locationProps = findField(locationStep?.fields ?? [], 'location', 'customComponent')
      .props as any;
    act(() => {
      locationProps.onAttendanceModeChange('online');
      locationProps.onValueChange('locationName', 'Ignored Hall');
      locationProps.onValueChange('onlineLink', 'https://meet.example.test');
      locationProps.onValueChange('country', 'DE');
    });
    const settingsStep = result.current.steps.find(
      step => step.label === 'pages.create.event.settings'
    );
    act(() =>
      (
        findField(settingsStep?.fields ?? [], 'settings', 'customComponent').props as any
      ).onVisibilityChange('private')
    );

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.onSubmit?.();
    });
    const payload = createFullEvent.mock.calls.at(-1)?.[0];
    expect(payload.event).toMatchObject({
      attendance_mode: 'online',
      location_type: 'online',
      location_name: null,
      location_url: 'https://meet.example.test',
      country: null,
      visibility: 'private',
    });
    expect(payload.process_task_completions).toHaveLength(3);
    expect(payload.process_task_completions.map((entry: any) => entry.process_task_id)).toEqual([
      'direct',
      'duplicate',
      'described',
    ]);
    expect(outcome).toMatchObject({
      status: 'success',
      target: { kind: 'route', to: '/amendments', search: { tab: 'process' }, hash: 'task' },
    });
  });

  it('covers valid step reasons, non-meeting capacity, and a null process-task result', async () => {
    openProcessTasks = null as any;
    const { result } = renderHook(() => useCreateEventForm());
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.validation.titleRequired'
    );
    fillTitle(result);
    fillDateTime(result);
    const timeStep = result.current.steps.find(
      step => step.label === 'pages.create.event.timeSeries.tabLabel'
    );
    expect(timeStep?.isValid()).toBe(true);
    const locationStep = result.current.steps.find(
      step => step.label === 'pages.create.event.location'
    );
    expect(locationStep?.getInvalidReason?.()).toBeNull();
    const locationProps = findField(locationStep?.fields ?? [], 'location', 'customComponent')
      .props as any;
    act(() => {
      locationProps.onAttendanceModeChange('hybrid');
      locationProps.onValueChange('capacity', '120');
    });
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBeNull();

    await act(async () => {
      await result.current.onSubmit?.();
    });
    expect(createFullEvent.mock.calls.at(-1)?.[0]?.event.capacity).toBe(120);
  });
});
