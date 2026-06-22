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
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { EventTypeInput } from '../ui/inputs/EventTypeInput';
import { type DelegateConfig } from '../ui/inputs/DelegateAllocationInput';
import { useEventActions } from '@/zero/events/useEventActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useCurrentUserActiveGroupIds, useGroupById } from '@/zero/groups/useGroupState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
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
import { attachProcessTaskToEvent } from '@/features/amendments/logic/attachProcessTaskToEvent';
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

type EventType = CreateEventType;
type MeetingType = 'one-on-one' | 'public-meeting';
type AttendanceMode = 'online' | 'hybrid' | 'offline';

export function useCreateEventForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateEventSearch;
  const { user } = useAuth();
  const { createEvent } = useEventActions();
  const { completeProcessTaskWithEvent } = useAmendmentActions();
  const commonActions = useCommonActions();
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
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [postCode, setPostCode] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [capacity, setCapacity] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [genderQuotaEnabled, setGenderQuotaEnabled] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [delegatesNominationDeadline, setDelegatesNominationDeadline] = useState('');
  const [amendmentDeadline, setAmendmentDeadline] = useState('');

  // Recurrence state
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const isRecurring = recurrencePattern !== 'none';
  const locationSummary = formatNamedLocation(locationName, {
    country,
    region,
    post_code: postCode,
    city,
    street,
    house_number: houseNumber,
  });

  const { allHashtags, userHashtags } = useCommonState({
    user_id: user?.id,
    loadAllHashtags: true,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );
  const { activeGroupIds } = useCurrentUserActiveGroupIds();
  const [openProcessTasks] = useQuery(
    groupId ? queries.amendments.openProcessTasksByGroup({ group_id: groupId }) : undefined
  );
  const isMeetingEvent = eventType === 'meeting';
  const groupRequired = eventType === 'general_assembly' || eventType === 'delegate_assembly';
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

      const createEventResult = createEvent({
        id: eventId,
        title: title.trim(),
        description: description ? toZeroRichTextValue(descriptionContent) : null,
        attendance_mode: attendanceMode,
        location_type: attendanceMode === 'online' ? 'online' : 'physical',
        location_name: attendanceMode !== 'online' ? locationName || null : null,
        location_url: attendanceMode !== 'offline' ? onlineLink || null : null,
        country: attendanceMode !== 'online' ? country || null : null,
        region: attendanceMode !== 'online' ? region || null : null,
        post_code: attendanceMode !== 'online' ? postCode || null : null,
        city: attendanceMode !== 'online' ? city || null : null,
        street: attendanceMode !== 'online' ? street || null : null,
        house_number: attendanceMode !== 'online' ? houseNumber || null : null,
        latitude: attendanceMode !== 'online' ? latitude : null,
        longitude: attendanceMode !== 'online' ? longitude : null,
        start_date,
        end_date,
        visibility: effectiveVisibility,
        gender_quota_enabled: genderQuotaEnabled,
        image_url: imageURL || null,
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
      });
      await serverConfirmed(createEventResult);
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'active' });

      if (hashtags.length > 0) {
        await commonActions.syncEntityHashtags('event', eventId, hashtags, [], allHashtags ?? []);
      }

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
      await Promise.all(
        matchingProcessTasks
          .filter(task => {
            if (attachedTaskIds.has(task.id)) {
              return false;
            }

            attachedTaskIds.add(task.id);
            return true;
          })
          .map(task =>
            attachProcessTaskToEvent({
              task,
              event: createdEvent,
              description:
                task.description?.trim() ||
                `Automatisch mit dem neuen Event "${title.trim()}" verknuepft.`,
              completeProcessTaskWithEvent,
            })
          )
      );

      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });

      if (searchParams.returnTo) {
        setIsSubmitting(false);
        return createSuccessSubmitOutcome(createReturnToSubmitTarget(searchParams.returnTo));
      }

      setIsSubmitting(false);
      return createSuccessSubmitOutcome(
        createRouteSubmitTarget('event', {
          to: '/event/$id',
          params: { id: eventId },
        })
      );
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
        { key: 'create', label: 'Erstellt Event' },
        { key: 'sync', label: 'Verknüpft Kontext und Aufgaben' },
        { key: 'ready', label: 'Bereitet Eventseite vor' },
      ],
      steps: [
        // 1. Basic Info first — title, description, image
        {
          label: t('pages.create.event.basicInfo'),
          isValid: () => !!title.trim(),
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
              key: 'image',
              kind: 'customComponent',
              component: ImageUpload,
              props: {
                currentImage: imageURL,
                onImageChange: (url: string) => setImageURL(url),
                cleanupOnRemove: true,
                entityType: 'events',
                entityId: eventId,
                label: t('pages.create.event.imageLabel'),
                description: t('pages.create.event.imageDescription'),
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
          isValid: () => (groupRequired ? !!groupId : true),
          optional: !groupRequired,
          fields: [
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.event.associatedGroupLabel'),
              hint: t('pages.create.event.tips.group'),
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
                filterFn: item => activeGroupIds.has(item.id),
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
                      electionModeLabel: translateText(
                        'generated.inline.0325_delegiertenwahl_f860c1a3'
                      ),
                      electionModeHint: translateText(
                        'generated.inline.0326_dieser_modus_wird_als_default_fuer_untergrupp_c5a2f055'
                      ),
                      electionModeDescriptions: {
                        list: 'Untergruppen vergeben mehrere Stimmen in einer Listenwahl.',
                        single: 'Untergruppen legen pro Delegiertensitz eine eigene Wahl an.',
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
          isValid: () => true,
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
                hashtags,
                hashtagPlaceholder: t('pages.create.event.hashtagPlaceholder'),
                preferredHashtagSuggestions,
                onVisibilityChange: setVisibility,
                onGenderQuotaEnabledChange: setGenderQuotaEnabled,
                onHashtagsChange: setHashtags,
              },
            },
          ],
        },
        // 8. Review
        {
          label: t('pages.create.common.review'),
          isValid: () =>
            !!title.trim() &&
            hasRequiredDateTimeRange &&
            timeSeriesValidationError === null &&
            processSchedulingValidationMessage === null,
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
                media: imageURL
                  ? { imageUrl: imageURL, imageAlt: title || 'Event cover image' }
                  : undefined,
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
                              value: t('common.enabled', 'Aktiviert'),
                            },
                          ]
                        : []),
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
      country,
      region,
      postCode,
      city,
      street,
      houseNumber,
      locationSummary,
      capacity,
      imageURL,
      visibility,
      genderQuotaEnabled,
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
      handleDescriptionContentChange,
      activeGroupIds,
      syncGroupSearch,
      t,
    ]
  );

  return config;
}

function createReturnToSubmitTarget(returnTo: string) {
  const routeTarget = parseInternalReturnTo(returnTo);

  if (routeTarget) {
    return createRouteSubmitTarget('event', {
      ...routeTarget,
      label: 'Zur Zielseite',
    });
  }

  return createExternalSubmitTarget('event', {
    href: returnTo,
    label: 'Zur Zielseite',
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
