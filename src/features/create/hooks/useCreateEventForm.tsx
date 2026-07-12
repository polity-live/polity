import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import type { Value } from 'platejs';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import {
  geoLocationFieldsFromShape,
  type GeoLocationShape,
} from '@/features/shared/logic/geoLocationShape';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { EventTypeInput } from '../ui/inputs/EventTypeInput';
import { type DelegateConfig } from '../ui/inputs/DelegateAllocationInput';
import { useEventActions } from '@/zero/events/useEventActions';
import { useCommonState } from '@/zero/common';
import { useGroupById } from '@/zero/groups/useGroupState';
import { useCreatableGroupIds } from '@/zero/rbac';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { queries } from '@/zero/queries';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import { type RecurrencePattern } from '@/features/events/logic/rruleHelpers';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { CreateRichTextField } from '../ui/inputs/CreateRichTextField';
import { EventMeetingSettingsInput } from '../ui/inputs/EventMeetingSettingsInput';
import { EventDelegateAllocationSettingsInput } from '../ui/inputs/EventDelegateAllocationSettingsInput';
import { EventLocationInput } from '../ui/inputs/EventLocationInput';
import { EventSettingsInput } from '../ui/inputs/EventSettingsInput';
import {
  DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
  type ChangeRequestVoteOrder,
} from '@/features/change-requests/logic/changeRequestVoteOrder';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import {
  type CreateEventType,
  getCreateEventSearchDefaults,
  type CreateEventSearch,
} from '../logic/createEventSearch';
import { getEventTypeTranslationKey } from '@/features/events/logic/getEventTypeTranslationKey';
import { buildRecurringEventFields } from '@/features/events/logic/buildRecurringEventFields';
import { buildEventTemporalFields } from '@/features/events/logic/buildEventTemporalFields';
import {
  canCreateDelegateAssemblyForGroup,
  DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE,
} from '@/features/events/logic/delegateAssemblyEligibility';
import {
  getEventTimeSeriesValidationError,
  hasRequiredEventDateTimeRange,
} from '@/features/events/logic/eventTimeSeriesValidation';
import { buildRRule, getRecurrenceDescription } from '@/features/events/logic/rruleHelpers';
import { EventTimeSeriesSection } from '@/features/events/ui/EventTimeSeriesSection';
import { type ElectionMode } from '@/features/elections/logic/electionMode';
import {
  getSchedulingWindowValidationMessage,
  getSchedulingWindowDisplayLabel,
  getProcessTaskSchedulingWindow,
  isEventWithinSchedulingWindow,
} from '@/features/amendments/logic/processTaskEventScheduling';
import {
  createBlockedSubmitOutcome,
  createExternalSubmitTarget,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import { consumeCreateRestoreDraft, trackCreateFinalization } from '../logic/createFinalization';
import {
  isValidOptionalEventStreamUrl,
  normalizeEventStreamUrl,
} from '@/features/events/logic/eventStreamUrl';

type EventType = CreateEventType;
type MeetingType = 'one-on-one' | 'public-meeting';
type AttendanceMode = 'online' | 'hybrid' | 'offline';

type CreateEventRestoreState = Partial<{
  eventType: EventType;
  meetingType: MeetingType;
  meetingMaxBookings: string;
  groupId: string;
  groupName: string;
  delegateConfig: DelegateConfig;
  delegateElectionMode: ElectionMode;
  title: string;
  description: string;
  descriptionContent: Value;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  attendanceMode: AttendanceMode;
  locationName: string;
  onlineLink: string;
  streamUrl: string;
  country: string;
  region: string;
  postCode: string;
  city: string;
  street: string;
  houseNumber: string;
  latitude: number | null;
  longitude: number | null;
  locationShape: GeoLocationShape | null;
  capacity: string;
  imageURL: string;
  videoURL: string;
  visibility: Visibility;
  genderQuotaEnabled: boolean;
  changeRequestVoteOrder: ChangeRequestVoteOrder;
  hashtags: string[];
  delegatesNominationDeadline: string;
  amendmentDeadline: string;
  recurrencePattern: RecurrencePattern;
  recurrenceInterval: number;
  recurrenceWeekdays: number[];
  recurrenceEndDate: string;
}>;

export function useCreateEventForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateEventSearch;
  const { user } = useAuth();
  const { createFullEvent } = useEventActions();
  const prefilledSearch = useMemo(() => getCreateEventSearchDefaults(searchParams), [searchParams]);
  const groupIdParam = searchParams.groupId ?? '';
  const directProcessTaskId = searchParams.processTaskId ?? null;

  const [eventId] = useState(() => crypto.randomUUID());
  const [eventType, setEventType] = useState<EventType>(() => prefilledSearch.eventType);
  const [meetingType, setMeetingType] = useState<MeetingType>('one-on-one');
  const [meetingMaxBookings, setMeetingMaxBookings] = useState('10');
  const [groupId, setGroupId] = useState(() => groupIdParam);
  const [groupName, setGroupName] = useState('');
  const { group } = useGroupById(groupId || undefined);
  const [delegateConfig, setDelegateConfig] = useState<DelegateConfig>({
    allocationMode: 'ratio',
    totalDelegates: 10,
    delegateRatio: 10,
  });
  const [delegateElectionMode, setDelegateElectionMode] = useState<ElectionMode>('list');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionContent, setDescriptionContent] = useState<Value>(EMPTY_RICH_TEXT_VALUE);
  const [startDate, setStartDate] = useState(() => prefilledSearch.startDate);
  const [startTime, setStartTime] = useState(() => prefilledSearch.startTime);
  const [endDate, setEndDate] = useState(() => prefilledSearch.endDate);
  const [endTime, setEndTime] = useState(() => prefilledSearch.endTime);
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('offline');
  const [locationName, setLocationName] = useState('');
  const [onlineLink, setOnlineLink] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [postCode, setPostCode] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationShape, setLocationShape] = useState<GeoLocationShape | null>(null);
  const [capacity, setCapacity] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [videoURL, setVideoURL] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [genderQuotaEnabled, setGenderQuotaEnabled] = useState(false);
  const [changeRequestVoteOrder, setChangeRequestVoteOrder] = useState<ChangeRequestVoteOrder>(
    DEFAULT_CHANGE_REQUEST_VOTE_ORDER
  );
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [delegatesNominationDeadline, setDelegatesNominationDeadline] = useState('');
  const [amendmentDeadline, setAmendmentDeadline] = useState('');

  // Recurrence state
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  useEffect(() => {
    const restoreDraft = consumeCreateRestoreDraft<CreateEventRestoreState>('event');
    if (!restoreDraft) return;
    const state = restoreDraft.formState;

    setEventType(state.eventType ?? prefilledSearch.eventType);
    setMeetingType(state.meetingType ?? 'one-on-one');
    setMeetingMaxBookings(state.meetingMaxBookings ?? '10');
    setGroupId(state.groupId ?? groupIdParam);
    setGroupName(state.groupName ?? '');
    setDelegateConfig(
      state.delegateConfig ?? {
        allocationMode: 'ratio',
        totalDelegates: 10,
        delegateRatio: 10,
      }
    );
    setDelegateElectionMode(state.delegateElectionMode ?? 'list');
    setTitle(state.title ?? '');
    setDescription(state.description ?? '');
    setDescriptionContent(state.descriptionContent ?? EMPTY_RICH_TEXT_VALUE);
    setStartDate(state.startDate ?? prefilledSearch.startDate);
    setStartTime(state.startTime ?? prefilledSearch.startTime);
    setEndDate(state.endDate ?? prefilledSearch.endDate);
    setEndTime(state.endTime ?? prefilledSearch.endTime);
    setAttendanceMode(state.attendanceMode ?? 'offline');
    setLocationName(state.locationName ?? '');
    setOnlineLink(state.onlineLink ?? '');
    setStreamUrl(state.streamUrl ?? '');
    setCountry(state.country ?? '');
    setRegion(state.region ?? '');
    setPostCode(state.postCode ?? '');
    setCity(state.city ?? '');
    setStreet(state.street ?? '');
    setHouseNumber(state.houseNumber ?? '');
    setLatitude(state.latitude ?? null);
    setLongitude(state.longitude ?? null);
    setLocationShape(state.locationShape ?? null);
    setCapacity(state.capacity ?? '');
    setImageURL(state.imageURL ?? '');
    setVideoURL(state.videoURL ?? '');
    setVisibility(state.visibility ?? 'public');
    setGenderQuotaEnabled(state.genderQuotaEnabled ?? false);
    setChangeRequestVoteOrder(state.changeRequestVoteOrder ?? DEFAULT_CHANGE_REQUEST_VOTE_ORDER);
    setHashtags(state.hashtags ?? []);
    setDelegatesNominationDeadline(state.delegatesNominationDeadline ?? '');
    setAmendmentDeadline(state.amendmentDeadline ?? '');
    setRecurrencePattern(state.recurrencePattern ?? 'none');
    setRecurrenceInterval(state.recurrenceInterval ?? 1);
    setRecurrenceWeekdays(state.recurrenceWeekdays ?? []);
    setRecurrenceEndDate(state.recurrenceEndDate ?? '');
  }, [groupIdParam, prefilledSearch]);
  const isRecurring = recurrencePattern !== 'none';
  const locationSummary = formatNamedLocation(locationName, {
    country,
    region,
    post_code: postCode,
    city,
    street,
    house_number: houseNumber,
  });

  const { userHashtags } = useCommonState({
    user_id: user?.id,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );
  const { creatableGroupIds: eventCreatableGroupIds, isLoading: groupPermissionLoading } =
    useCreatableGroupIds('events');
  const [openProcessTasks] = useQuery(
    groupId ? queries.amendments.openProcessTasksByGroup({ group_id: groupId }) : undefined
  );
  const isMeetingEvent = eventType === 'meeting';
  const groupRequired = eventType === 'general_assembly' || eventType === 'delegate_assembly';
  const selectedGroupPermissionPending = Boolean(groupId && groupPermissionLoading);
  const selectedGroupPermissionDenied = Boolean(
    groupId && !groupPermissionLoading && !eventCreatableGroupIds.has(groupId)
  );
  const selectedGroupIsValid =
    (!groupRequired || Boolean(groupId)) &&
    (!groupId || (!selectedGroupPermissionPending && !selectedGroupPermissionDenied));
  const groupInvalidReason =
    !groupId && groupRequired
      ? t('pages.create.event.validation.groupRequiredForAssembly')
      : selectedGroupPermissionPending
        ? t('pages.create.event.validation.groupPermissionPending')
        : selectedGroupPermissionDenied
          ? t('pages.create.event.validation.groupPermissionDenied')
          : null;
  const normalizedMeetingBookings =
    meetingType === 'one-on-one' ? 1 : Math.max(1, Number.parseInt(meetingMaxBookings, 10) || 1);
  const effectiveVisibility = isMeetingEvent
    ? meetingType === 'public-meeting'
      ? 'public'
      : 'private'
    : visibility;
  const eventTypeLabel = t(
    `pages.create.event.eventTypes.${getEventTypeTranslationKey(eventType)}`
  );
  const meetingFormatLabel =
    meetingType === 'public-meeting'
      ? t('pages.create.event.meetingFormats.publicMeeting')
      : t('pages.create.event.meetingFormats.oneOnOne');
  const delegateAllocationLabel =
    delegateConfig.allocationMode === translateText('generated.inline.0032_ratio_4b6339ba')
      ? `1:${delegateConfig.delegateRatio}`
      : translateText('generated.inline.0033_totaldelegates_total_f6e325f1', {
          totalDelegates: delegateConfig.totalDelegates,
        });
  const delegateElectionModeLabel =
    delegateElectionMode === translateText('generated.inline.0034_list_38b62be4')
      ? 'Listenwahl'
      : 'Einzelwahl';
  const locationTypeLabel =
    attendanceMode === translateText('generated.inline.0035_online_2dbc2fd2')
      ? 'Online'
      : attendanceMode === translateText('generated.inline.0036_hybrid_e2ac482d')
        ? 'Hybrid'
        : 'Offline';
  const visibilityLabel =
    effectiveVisibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : effectiveVisibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');
  const recurrenceRule = isRecurring
    ? buildRRule({
        pattern: recurrencePattern,
        interval: recurrenceInterval,
        weekdays: recurrenceWeekdays,
        endDate: recurrenceEndDate || null,
      })
    : null;
  const recurrenceSummary = isRecurring
    ? recurrenceRule
      ? getRecurrenceDescription(recurrenceRule, t)
      : t(`pages.create.event.recurringPatterns.${recurrencePattern}`)
    : null;
  const timeSeriesValidationError = getEventTimeSeriesValidationError({
    startDate,
    startTime,
    endDate,
    endTime,
    recurrencePattern,
    recurrenceWeekdays,
    requireCompleteDateTimeRange: true,
  });
  const hasRequiredDateTimeRange = hasRequiredEventDateTimeRange({
    startDate,
    startTime,
    endDate,
    endTime,
  });
  const timeSeriesValidationMessage =
    timeSeriesValidationError === 'missing-required-range'
      ? t('pages.create.event.timeSeries.validation.dateTimeRangeRequired')
      : timeSeriesValidationError === 'missing-start-date'
        ? t('pages.create.event.timeSeries.validation.startDateRequired')
        : timeSeriesValidationError === 'missing-weekdays'
          ? t('pages.create.event.timeSeries.validation.weekdaysRequired')
          : null;
  const processSchedulingValidationMessage = getSchedulingWindowValidationMessage({
    startDate,
    startTime,
    minStartDate: searchParams.minStartDate,
    minStartTime: searchParams.minStartTime,
    maxStartDate: searchParams.maxStartDate,
    maxStartTime: searchParams.maxStartTime,
  });
  const processSchedulingWindowMessage = getSchedulingWindowDisplayLabel({
    minStartDate: searchParams.minStartDate,
    minStartTime: searchParams.minStartTime,
    maxStartDate: searchParams.maxStartDate,
    maxStartTime: searchParams.maxStartTime,
  });
  const combinedTimeSeriesValidationMessage =
    timeSeriesValidationMessage ?? processSchedulingValidationMessage;

  const handleDescriptionContentChange = useCallback((value: Value) => {
    setDescriptionContent(value);
    setDescription(richTextToPlainText(value));
  }, []);

  useEffect(() => {
    setGroupId(groupIdParam);
  }, [groupIdParam]);

  useEffect(() => {
    if (!groupId) {
      if (groupName) {
        setGroupName('');
      }
      return;
    }

    const nextGroupName = group?.name ?? '';
    if (nextGroupName && groupName !== nextGroupName) {
      setGroupName(nextGroupName);
    }
  }, [group?.name, groupId, groupName]);

  useEffect(() => {
    if (!searchParams.minStartDate && !searchParams.maxStartDate) {
      return;
    }

    if (!startDate && searchParams.minStartDate) {
      setStartDate(searchParams.minStartDate);
    }

    if (!endDate && searchParams.maxStartDate) {
      setEndDate(searchParams.maxStartDate);
    }
  }, [endDate, searchParams.maxStartDate, searchParams.minStartDate, startDate]);

  const syncGroupSearch = useCallback(
    (nextGroupId: string) => {
      navigate({
        to: '/create/event',
        search: mergeCreateSearchParams(searchParams, {
          groupId: nextGroupId || undefined,
        }),
        replace: true,
      });
    },
    [navigate, searchParams]
  );

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!title.trim()) return createBlockedSubmitOutcome();
    if (!isValidOptionalEventStreamUrl(streamUrl)) {
      toast.error(t('pages.create.event.streamUrlInvalid'));
      return createBlockedSubmitOutcome();
    }
    if (!selectedGroupIsValid) {
      toast.error(groupInvalidReason ?? t('pages.create.error.createFailed'));
      return createBlockedSubmitOutcome();
    }
    if (eventType === 'delegate_assembly' && !canCreateDelegateAssemblyForGroup(group)) {
      toast.error(DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE);
      return createBlockedSubmitOutcome();
    }

    if (timeSeriesValidationError === 'missing-required-range') {
      toast.error(t('pages.create.event.timeSeries.validation.dateTimeRangeRequired'));
      return createBlockedSubmitOutcome();
    }

    if (timeSeriesValidationError === 'missing-start-date') {
      toast.error(t('pages.create.event.timeSeries.validation.startDateRequired'));
      return createBlockedSubmitOutcome();
    }

    if (timeSeriesValidationError === 'missing-weekdays') {
      toast.error(t('pages.create.event.timeSeries.validation.weekdaysRequired'));
      return createBlockedSubmitOutcome();
    }

    if (processSchedulingValidationMessage) {
      toast.error(processSchedulingValidationMessage);
      return createBlockedSubmitOutcome();
    }

    setIsSubmitting(true);
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      const recurringFields = buildRecurringEventFields({
        isRecurring,
        recurrence: {
          pattern: recurrencePattern,
          interval: recurrenceInterval,
          weekdays: recurrenceWeekdays,
          endDate: recurrenceEndDate || null,
        },
      });
      const { start_date, end_date, amendment_deadline, delegates_nomination_deadline } =
        buildEventTemporalFields({
          startDate,
          startTime,
          endDate,
          endTime,
          amendmentDeadline,
          delegatesNominationDeadline,
        });

      const locationFields = geoLocationFieldsFromShape(locationShape);
      const eventPayload = {
        id: eventId,
        title: title.trim(),
        description: description ? toZeroRichTextValue(descriptionContent) : null,
        attendance_mode: attendanceMode,
        location_type: attendanceMode === 'online' ? 'online' : 'physical',
        location_name: attendanceMode !== 'online' ? locationName || null : null,
        location_url: attendanceMode !== 'offline' ? onlineLink || null : null,
        stream_url: normalizeEventStreamUrl(streamUrl),
        country: attendanceMode !== 'online' ? country || null : null,
        region: attendanceMode !== 'online' ? region || null : null,
        post_code: attendanceMode !== 'online' ? postCode || null : null,
        city: attendanceMode !== 'online' ? city || null : null,
        street: attendanceMode !== 'online' ? street || null : null,
        house_number: attendanceMode !== 'online' ? houseNumber || null : null,
        latitude: attendanceMode !== 'online' ? latitude : null,
        longitude: attendanceMode !== 'online' ? longitude : null,
        location_kind: attendanceMode !== 'online' ? locationFields.location_kind : null,
        location_place_id: attendanceMode !== 'online' ? locationFields.location_place_id : null,
        location_boundary_source:
          attendanceMode !== 'online' ? locationFields.location_boundary_source : null,
        location_geometry: attendanceMode !== 'online' ? locationFields.location_geometry : null,
        location_bounds: attendanceMode !== 'online' ? locationFields.location_bounds : null,
        start_date,
        end_date,
        visibility: effectiveVisibility,
        gender_quota_enabled: genderQuotaEnabled,
        change_request_vote_order: changeRequestVoteOrder,
        image_url: imageURL || null,
        video_url: videoURL || null,
        capacity: isMeetingEvent ? null : capacity ? parseInt(capacity, 10) : null,
        event_type: eventType,
        group_id: groupId || null,
        creator_id: '',
        ...recurringFields,
        delegates_nomination_deadline,
        amendment_deadline,
        has_delegates: eventType === 'delegate_assembly',
        delegate_seat_allocation_type:
          eventType === 'delegate_assembly'
            ? delegateConfig.allocationMode === 'total'
              ? 'fixed_total'
              : 'members_per_delegate'
            : null,
        main_group_delegate_allocation_mode:
          eventType === 'delegate_assembly' && delegateConfig.allocationMode === 'ratio'
            ? String(Math.max(1, delegateConfig.delegateRatio || 1))
            : null,
        delegate_election_mode: eventType === 'delegate_assembly' ? delegateElectionMode : null,
        meeting_type: isMeetingEvent ? meetingType : null,
        is_bookable: isMeetingEvent,
        max_bookings: isMeetingEvent ? normalizedMeetingBookings : null,
        ...(eventType === 'delegate_assembly'
          ? {
              total_delegate_seats:
                delegateConfig.allocationMode === 'total' ? delegateConfig.totalDelegates : null,
            }
          : {}),
      };

      const createdEvent = {
        id: eventId,
        title: title.trim(),
        start_date,
      };
      const matchingProcessTasks = (openProcessTasks ?? []).filter(task => {
        if (task.status !== 'open') {
          return false;
        }

        const withinSchedulingWindow = isEventWithinSchedulingWindow(
          createdEvent,
          getProcessTaskSchedulingWindow({
            due_at: task.due_at ?? null,
            metadata: task.metadata,
          })
        );

        if (task.id === directProcessTaskId) {
          return withinSchedulingWindow;
        }

        if (task.task_type !== 'schedule_event') {
          return false;
        }

        return withinSchedulingWindow;
      });

      const attachedTaskIds = new Set<string>();
      const processTaskCompletions = matchingProcessTasks
        .filter(task => {
          if (attachedTaskIds.has(task.id)) {
            return false;
          }

          attachedTaskIds.add(task.id);
          return true;
        })
        .map(task => ({
          process_task_id: task.id,
          event_id: createdEvent.id,
          description:
            task.description?.trim() ||
            t('pages.create.event.autoLinkedToNewEvent', { title: title.trim() }),
        }));

      const createEventPayload = {
        event: eventPayload,
        hashtags,
        process_task_completions: processTaskCompletions,
      };
      const createEventResult = createFullEvent(createEventPayload);
      await createEventResult.client;

      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'active' });

      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      const recoveryFormState: CreateEventRestoreState = {
        eventType,
        meetingType,
        meetingMaxBookings,
        groupId,
        groupName,
        delegateConfig,
        delegateElectionMode,
        title,
        description,
        descriptionContent,
        startDate,
        startTime,
        endDate,
        endTime,
        attendanceMode,
        locationName,
        onlineLink,
        streamUrl,
        country,
        region,
        postCode,
        city,
        street,
        houseNumber,
        latitude,
        longitude,
        locationShape,
        capacity,
        imageURL,
        videoURL,
        visibility: effectiveVisibility,
        genderQuotaEnabled,
        changeRequestVoteOrder,
        hashtags,
        delegatesNominationDeadline,
        amendmentDeadline,
        recurrencePattern,
        recurrenceInterval,
        recurrenceWeekdays,
        recurrenceEndDate,
      };

      if (searchParams.returnTo) {
        const target = createReturnToSubmitTarget(
          searchParams.returnTo,
          t('pages.create.event.targetLabel')
        );
        trackCreateFinalization({
          result: createEventResult,
          draft: {
            id: `event:${eventId}`,
            entityType: 'event',
            entityId: eventId,
            createPath: '/create/event',
            formState: recoveryFormState,
            mutationPayload: createEventPayload,
            target,
          },
        });
        setIsSubmitting(false);
        return createSuccessSubmitOutcome(target);
      }

      const target = createRouteSubmitTarget('event', {
        to: '/event/$id',
        params: { id: eventId },
      });
      trackCreateFinalization({
        result: createEventResult,
        draft: {
          id: `event:${eventId}`,
          entityType: 'event',
          entityId: eventId,
          createPath: '/create/event',
          formState: recoveryFormState,
          mutationPayload: createEventPayload,
          target,
        },
      });
      setIsSubmitting(false);
      return createSuccessSubmitOutcome(target);
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'event',
      title: 'pages.create.event.title',
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: t('pages.create.progress.submission.steps.event.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.event.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.event.ready') },
      ],
      steps: [
        // 1. Basic Info first — title, description, image
        {
          label: t('pages.create.event.basicInfo'),
          isValid: () => !!title.trim(),
          getInvalidReason: () => t('pages.create.validation.titleRequired'),
          fields: [
            {
              key: 'title',
              kind: 'text',
              label: t('pages.create.event.titleLabel'),
              required: true,
              hint: t('pages.create.event.tips.title'),
              value: title,
              onValueChange: setTitle,
              placeholder: t('pages.create.event.titlePlaceholder'),
            },
            {
              key: 'description',
              kind: 'customComponent',
              component: CreateRichTextField,
              props: {
                label: t('pages.create.event.descriptionLabel'),
                description: t('pages.create.event.tips.description'),
                value: descriptionContent,
                onChange: handleDescriptionContentChange,
                placeholder: t('pages.create.event.descriptionPlaceholder'),
              },
            },
            {
              key: 'media',
              kind: 'customComponent',
              component: MediaUpload,
              props: {
                currentImage: imageURL,
                onImageChange: (url: string) => setImageURL(url),
                currentVideo: videoURL,
                onVideoChange: (url: string) => setVideoURL(url),
                cleanupOnRemove: true,
                exclusiveMedia: true,
                entityType: 'events',
                entityId: eventId,
                imageLabel: t('pages.create.event.imageLabel'),
                imageDescription: t('pages.create.event.imageDescription'),
                videoLabel: t('common.actions.uploadVideo'),
                videoDescription: t('common.media.videoDescription'),
              },
            },
          ],
        },
        // 2. Event Type
        {
          label: t('pages.create.event.eventType'),
          isValid: () => true,
          fields: [
            {
              key: 'event-type',
              kind: 'customComponent',
              component: EventTypeInput,
              props: { value: eventType, onChange: setEventType },
            },
          ],
        },
        ...(isMeetingEvent
          ? [
              {
                label: t('pages.create.event.meetingSettings'),
                isValid: () => normalizedMeetingBookings > 0,
                fields: [
                  {
                    key: 'meeting-settings',
                    kind: 'customComponent' as const,
                    component: EventMeetingSettingsInput,
                    props: {
                      meetingType,
                      meetingMaxBookings,
                      labels: {
                        format: t('pages.create.event.meetingFormat'),
                        oneOnOne: t('pages.create.event.meetingFormats.oneOnOne'),
                        publicMeeting: t('pages.create.event.meetingFormats.publicMeeting'),
                        oneOnOneDescription: t('pages.create.event.meetingFormats.oneOnOneDesc'),
                        publicMeetingDescription: t(
                          'pages.create.event.meetingFormats.publicMeetingDesc'
                        ),
                        oneOnOneLimit: t('pages.create.event.meetingFormats.oneOnOneLimit'),
                        bookingLimit: t('pages.create.event.bookingLimit'),
                        bookingLimitHint: t('pages.create.event.bookingLimitHint'),
                        bookingLimitPlaceholder: t('pages.create.event.bookingLimitPlaceholder'),
                      },
                      onMeetingTypeChange: setMeetingType,
                      onMeetingMaxBookingsChange: setMeetingMaxBookings,
                    },
                  },
                ],
              },
            ]
          : []),
        // 3. Associated Group
        {
          label: t('pages.create.event.associatedGroup'),
          isValid: () => selectedGroupIsValid,
          getInvalidReason: () => groupInvalidReason,
          optional: !groupRequired,
          fields: [
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.event.associatedGroupLabel'),
              hint: t('pages.create.event.tips.group'),
              invalid: Boolean(groupInvalidReason),
              error: groupInvalidReason ?? undefined,
              required: groupRequired,
              props: {
                entityTypes: ['group'],
                value: groupId || undefined,
                onChange: item => {
                  const nextGroupId = item?.id ?? '';
                  setGroupId(nextGroupId);
                  setGroupName(item?.label ?? '');
                  syncGroupSearch(nextGroupId);
                },
                filterFn: item => eventCreatableGroupIds.has(item.id),
                placeholder: t('pages.create.event.associatedGroupPlaceholder'),
              },
            },
          ],
        },
        // 4. Delegate Allocation (only for delegate_assembly)
        ...(eventType === 'delegate_assembly'
          ? [
              {
                label: t('pages.create.event.delegateAllocation'),
                isValid: () => true,
                fields: [
                  {
                    key: 'delegate-allocation',
                    kind: 'customComponent' as const,
                    component: EventDelegateAllocationSettingsInput,
                    props: {
                      delegateConfig,
                      delegateElectionMode,
                      electionModeLabel: t('features.elections.mode.typeLabel'),
                      electionModeHint: translateText(
                        'generated.inline.0326_dieser_modus_wird_als_default_fuer_untergrupp_c5a2f055'
                      ),
                      electionModeDescriptions: {
                        list: t('pages.create.event.delegateElectionModeDescriptions.list'),
                        single: t('pages.create.event.delegateElectionModeDescriptions.single'),
                      },
                      onDelegateConfigChange: setDelegateConfig,
                      onDelegateElectionModeChange: setDelegateElectionMode,
                    },
                  },
                ],
              },
            ]
          : []),
        // 5. Date, time, recurrence, and time-based deadlines
        {
          label: t('pages.create.event.timeSeries.tabLabel'),
          isValid: () =>
            timeSeriesValidationError === null && processSchedulingValidationMessage === null,
          getInvalidReason: () => combinedTimeSeriesValidationMessage,
          fields: [
            {
              key: 'time-series',
              kind: 'customComponent',
              component: EventTimeSeriesSection,
              props: {
                startDate,
                startTime,
                endDate,
                endTime,
                onDateTimeChange: (field: string, value: string) => {
                  if (field === 'startDate') setStartDate(value);
                  else if (field === 'startTime') setStartTime(value);
                  else if (field === 'endDate') setEndDate(value);
                  else if (field === 'endTime') setEndTime(value);
                },
                recurrencePattern,
                onRecurrencePatternChange: setRecurrencePattern,
                recurrenceEndDate,
                onRecurrenceEndDateChange: setRecurrenceEndDate,
                recurrenceInterval,
                onRecurrenceIntervalChange: setRecurrenceInterval,
                recurrenceWeekdays,
                onRecurrenceWeekdaysChange: setRecurrenceWeekdays,
                schedulingWindowMessage: processSchedulingWindowMessage,
                validationMessage: combinedTimeSeriesValidationMessage,
                minDate: searchParams.minStartDate,
                minTime: searchParams.minStartTime,
                maxDate: searchParams.maxStartDate,
                maxTime: searchParams.maxStartTime,
                deadlines: [
                  ...(eventType === 'delegate_assembly'
                    ? [
                        {
                          id: 'delegatesNominationDeadline',
                          label: t('pages.create.event.delegateNominationDeadline'),
                          value: delegatesNominationDeadline,
                          onChange: setDelegatesNominationDeadline,
                          hint: t('pages.create.event.delegateNominationDeadlineDesc'),
                        },
                      ]
                    : []),
                  ...(eventType === 'delegate_assembly' || eventType === 'general_assembly'
                    ? [
                        {
                          id: 'amendmentDeadline',
                          label: t('pages.create.event.amendmentCutoffDeadline'),
                          value: amendmentDeadline,
                          onChange: setAmendmentDeadline,
                          hint: t('pages.create.event.amendmentCutoffDeadlineDesc'),
                        },
                      ]
                    : []),
                ],
              },
            },
          ],
        },
        // 6. Location (tabbed: Physical / Online)
        {
          label: t('pages.create.event.location'),
          isValid: () => isValidOptionalEventStreamUrl(streamUrl),
          getInvalidReason: () =>
            isValidOptionalEventStreamUrl(streamUrl)
              ? null
              : t('pages.create.event.streamUrlInvalid'),
          optional: true,
          fields: [
            {
              key: 'location',
              kind: 'customComponent',
              component: EventLocationInput,
              props: {
                attendanceMode,
                values: {
                  locationName,
                  onlineLink,
                  streamUrl,
                  country,
                  region,
                  postCode,
                  city,
                  street,
                  houseNumber,
                  latitude,
                  longitude,
                  capacity,
                },
                shape: locationShape,
                onShapeChange: setLocationShape,
                showCapacity: !isMeetingEvent,
                labels: {
                  attendanceMode: translateText('generated.inline.0327_attendance_mode_507f30a9'),
                  online: translateText('generated.inline.0046_online_c3e839df'),
                  hybrid: translateText('generated.inline.0047_hybrid_8e01f6bc'),
                  offline: translateText('generated.inline.0048_offline_e01fa717'),
                  venueName: t('pages.create.event.venueName'),
                  venueNameHint: t('pages.create.event.tips.venueName'),
                  venueNamePlaceholder: t('pages.create.event.venueNamePlaceholder'),
                  meetingLink: t('pages.create.event.meetingLink'),
                  meetingLinkHint: t('pages.create.event.tips.meetingLink'),
                  meetingLinkPlaceholder: t('pages.create.event.meetingLinkPlaceholder'),
                  streamUrl: t('pages.create.event.streamUrl'),
                  streamUrlHint: t('pages.create.event.streamUrlHint'),
                  streamUrlPlaceholder: t('pages.create.event.streamUrlPlaceholder'),
                  streamUrlInvalid: t('pages.create.event.streamUrlInvalid'),
                  capacity: t('pages.create.event.capacityLabel'),
                  capacityHint: t('pages.create.event.tips.capacity'),
                  capacityPlaceholder: t('pages.create.event.capacityPlaceholder'),
                  country: t('pages.create.event.country'),
                  region: t('pages.create.event.region'),
                  city: t('pages.create.event.city'),
                  postCode: t('pages.create.event.postalCode'),
                  street: t('pages.create.event.street'),
                  houseNumber: t('pages.create.event.houseNumber'),
                },
                onAttendanceModeChange: setAttendanceMode,
                onValueChange: (field: string, value: string | number | null) => {
                  switch (field) {
                    case 'locationName':
                      setLocationName(String(value ?? ''));
                      break;
                    case 'onlineLink':
                      setOnlineLink(String(value ?? ''));
                      break;
                    case 'streamUrl':
                      setStreamUrl(String(value ?? ''));
                      break;
                    case 'country':
                      setCountry(String(value ?? ''));
                      break;
                    case 'region':
                      setRegion(String(value ?? ''));
                      break;
                    case 'postCode':
                      setPostCode(String(value ?? ''));
                      break;
                    case 'city':
                      setCity(String(value ?? ''));
                      break;
                    case 'street':
                      setStreet(String(value ?? ''));
                      break;
                    case 'houseNumber':
                      setHouseNumber(String(value ?? ''));
                      break;
                    case 'latitude':
                      setLatitude(typeof value === 'number' ? value : null);
                      break;
                    case 'longitude':
                      setLongitude(typeof value === 'number' ? value : null);
                      break;
                    case 'capacity':
                      setCapacity(String(value ?? ''));
                      break;
                  }
                },
              },
            },
          ],
        },
        // 7. Settings
        {
          label: t('pages.create.event.settings'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'settings',
              kind: 'customComponent',
              component: EventSettingsInput,
              props: {
                showVisibility: !isMeetingEvent,
                visibility,
                genderQuotaEnabled,
                changeRequestVoteOrder,
                hashtags,
                hashtagPlaceholder: t('pages.create.event.hashtagPlaceholder'),
                preferredHashtagSuggestions,
                onVisibilityChange: setVisibility,
                onGenderQuotaEnabledChange: setGenderQuotaEnabled,
                onChangeRequestVoteOrderChange: setChangeRequestVoteOrder,
                onHashtagsChange: setHashtags,
              },
            },
          ],
        },
        // 8. Review
        {
          label: t('pages.create.common.review'),
          isValid: () =>
            selectedGroupIsValid &&
            !!title.trim() &&
            hasRequiredDateTimeRange &&
            timeSeriesValidationError === null &&
            processSchedulingValidationMessage === null,
          getInvalidReason: () =>
            !title.trim()
              ? t('pages.create.validation.titleRequired')
              : (groupInvalidReason ??
                timeSeriesValidationMessage ??
                processSchedulingValidationMessage ??
                null),
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'event',
                badge: t('pages.create.event.reviewBadge'),
                secondaryBadge: eventTypeLabel,
                title: title || t('pages.create.event.titlePlaceholder'),
                subtitle: description || undefined,
                media: {
                  imageUrl: imageURL || undefined,
                  imageAlt: title || t('pages.create.event.coverImageAlt'),
                  videoUrl: videoURL || undefined,
                },
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                sections: [
                  {
                    title: t('pages.create.event.basicInfo'),
                    fields: [
                      {
                        label: t('pages.create.event.eventType'),
                        value: eventTypeLabel,
                      },
                      ...(groupId
                        ? [{ label: t('pages.create.event.associatedGroup'), value: groupName }]
                        : []),
                      ...(isMeetingEvent
                        ? [
                            {
                              label: t('pages.create.event.meetingFormat'),
                              value: meetingFormatLabel,
                            },
                            {
                              label: t('pages.create.event.bookingLimit'),
                              value: String(normalizedMeetingBookings),
                            },
                          ]
                        : []),
                      ...(!isMeetingEvent && capacity
                        ? [{ label: t('pages.create.event.capacityLabel'), value: capacity }]
                        : []),
                      ...(eventType === 'delegate_assembly'
                        ? [
                            {
                              label: t('pages.create.event.delegateAllocation'),
                              value: delegateAllocationLabel,
                            },
                            {
                              label: translateText(
                                'generated.inline.0057_delegiertenwahl_f860c1a3'
                              ),
                              value: delegateElectionModeLabel,
                            },
                          ]
                        : []),
                      {
                        label: t('pages.create.common.visibility'),
                        value: visibilityLabel,
                      },
                      ...(genderQuotaEnabled
                        ? [
                            {
                              label: t(
                                'features.events.agenda.genderQuota.settingsLabel',
                                'Genderquotierte Redeliste'
                              ),
                              value: t('common.enabled'),
                            },
                          ]
                        : []),
                      {
                        label: t(
                          'features.events.agenda.changeRequestVoteOrder.settingsLabel',
                          'Change request voting order'
                        ),
                        value: t(
                          `features.events.agenda.changeRequestVoteOrder.${changeRequestVoteOrder}`,
                          changeRequestVoteOrder
                        ),
                      },
                    ],
                  },
                  {
                    title: t('pages.create.event.dateTime'),
                    fields: [
                      ...(startDate
                        ? [
                            {
                              label: t('pages.create.event.startDate'),
                              value: `${startDate}${startTime ? ` ${startTime}` : ''}`,
                            },
                          ]
                        : []),
                      ...(endDate
                        ? [
                            {
                              label: t('pages.create.event.endDate'),
                              value: `${endDate}${endTime ? ` ${endTime}` : ''}`,
                            },
                          ]
                        : []),
                      ...(recurrenceSummary
                        ? [
                            {
                              label: t('pages.create.event.recurring'),
                              value: recurrenceSummary,
                            },
                            ...(recurrenceEndDate
                              ? [
                                  {
                                    label: t('pages.create.event.recurringEnds'),
                                    value: recurrenceEndDate,
                                  },
                                ]
                              : []),
                          ]
                        : []),
                      ...(delegatesNominationDeadline
                        ? [
                            {
                              label: t('pages.create.event.delegateNominationDeadline'),
                              value: delegatesNominationDeadline,
                            },
                          ]
                        : []),
                      ...(amendmentDeadline
                        ? [
                            {
                              label: t('pages.create.event.amendmentCutoffDeadline'),
                              value: amendmentDeadline,
                            },
                          ]
                        : []),
                    ],
                  },
                  {
                    title: t('pages.create.event.location'),
                    fields: [
                      {
                        label: t('pages.create.event.location'),
                        value: locationTypeLabel,
                      },
                      ...(attendanceMode !== 'online'
                        ? [
                            {
                              label: t('pages.create.event.venueName'),
                              value: locationSummary || t('pages.create.event.inPerson'),
                            },
                          ]
                        : []),
                      ...(attendanceMode !== 'offline' && onlineLink
                        ? [{ label: t('pages.create.event.meetingLink'), value: onlineLink }]
                        : []),
                      ...(streamUrl
                        ? [{ label: t('pages.create.event.streamUrl'), value: streamUrl }]
                        : []),
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }),
    [
      title,
      description,
      descriptionContent,
      startDate,
      startTime,
      endDate,
      endTime,
      attendanceMode,
      locationName,
      onlineLink,
      streamUrl,
      country,
      region,
      postCode,
      city,
      street,
      houseNumber,
      latitude,
      longitude,
      locationShape,
      locationSummary,
      capacity,
      imageURL,
      videoURL,
      visibility,
      genderQuotaEnabled,
      changeRequestVoteOrder,
      hashtags,
      preferredHashtagSuggestions,
      eventType,
      meetingType,
      meetingMaxBookings,
      normalizedMeetingBookings,
      effectiveVisibility,
      eventTypeLabel,
      meetingFormatLabel,
      delegateAllocationLabel,
      locationTypeLabel,
      visibilityLabel,
      recurrenceSummary,
      hasRequiredDateTimeRange,
      timeSeriesValidationError,
      timeSeriesValidationMessage,
      processSchedulingValidationMessage,
      combinedTimeSeriesValidationMessage,
      isMeetingEvent,
      groupId,
      groupName,
      delegateConfig,
      delegateElectionMode,
      delegateElectionModeLabel,
      isSubmitting,
      recurrencePattern,
      recurrenceInterval,
      recurrenceWeekdays,
      recurrenceEndDate,
      isRecurring,
      delegatesNominationDeadline,
      amendmentDeadline,
      eventId,
      openProcessTasks,
      groupRequired,
      groupInvalidReason,
      selectedGroupIsValid,
      handleDescriptionContentChange,
      eventCreatableGroupIds,
      syncGroupSearch,
      t,
    ]
  );

  return config;
}

function createReturnToSubmitTarget(returnTo: string, label: string) {
  const routeTarget = parseInternalReturnTo(returnTo);

  if (routeTarget) {
    return createRouteSubmitTarget('event', {
      ...routeTarget,
      label,
    });
  }

  return createExternalSubmitTarget('event', {
    href: returnTo,
    label,
  });
}

function parseInternalReturnTo(returnTo: string): {
  to: string;
  search?: Record<string, string>;
  hash?: string;
} | null {
  try {
    const isRootRelative = returnTo.startsWith('/');
    const isHttpUrl = /^https?:\/\//i.test(returnTo);

    if (!isRootRelative && !isHttpUrl) {
      return null;
    }

    const baseOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://polity.local';
    const url = new URL(returnTo, baseOrigin);

    if (!isRootRelative && url.origin !== baseOrigin) {
      return null;
    }

    const search: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      search[key] = value;
    });

    return {
      to: url.pathname,
      search: Object.keys(search).length > 0 ? search : undefined,
      hash: url.hash ? url.hash.slice(1) : undefined,
    };
  } catch {
    return null;
  }
}
