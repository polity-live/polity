import { FormControlLabel } from '@/features/shared/ui/form';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import type { Value } from 'platejs';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { CreateInputField } from '../ui/CreateFields';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { EventTypeInput } from '../ui/inputs/EventTypeInput';
import { DelegateAllocationInput, type DelegateConfig } from '../ui/inputs/DelegateAllocationInput';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { useEventActions } from '@/zero/events/useEventActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useCurrentUserActiveGroupIds, useGroupById } from '@/zero/groups/useGroupState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { queries } from '@/zero/queries';
import type { CreateFormConfig } from '../types/create-form.types';
import { type RecurrencePattern } from '@/features/events/logic/rruleHelpers';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import { CreateTypeaheadField } from '../ui/CreateFields';
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
  getEventTimeSeriesValidationError,
  hasRequiredEventDateTimeRange,
} from '@/features/events/logic/eventTimeSeriesValidation';
import { buildRRule, getRecurrenceDescription } from '@/features/events/logic/rruleHelpers';
import { EventTimeSeriesSection } from '@/features/events/ui/EventTimeSeriesSection';
import { ElectionModeInput } from '@/features/elections/ui/ElectionModeInput';
import { type ElectionMode } from '@/features/elections/logic/electionMode';
import { attachProcessTaskToEvent } from '@/features/amendments/logic/attachProcessTaskToEvent';
import {
  getSchedulingWindowValidationMessage,
  getSchedulingWindowDisplayLabel,
  getProcessTaskSchedulingWindow,
  isEventWithinSchedulingWindow,
} from '@/features/amendments/logic/processTaskEventScheduling';

type EventType = CreateEventType;
type MeetingType = 'one-on-one' | 'public-meeting';
type AttendanceMode = 'online' | 'hybrid' | 'offline';

export function useCreateEventForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateEventSearch;
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

  const { allHashtags } = useCommonState({ loadAllHashtags: true });
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

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (
      eventType === 'delegate_assembly' &&
      (!group ||
        (group.group_type !== 'hierarchical' &&
          !(
            group.group_type === 'sibling' &&
            (group.sibling_membership_mode === 'parliament' ||
              group.sibling_membership_mode === 'elected')
          )))
    ) {
      toast.error(
        translateText(
          'generated.inline.0324_delegiertenversammlungen_koennen_nur_fuer_hie_dc8b32df'
        )
      );
      return;
    }

    if (timeSeriesValidationError === 'missing-required-range') {
      toast.error(t('pages.create.event.timeSeries.validation.dateTimeRangeRequired'));
      return;
    }

    if (timeSeriesValidationError === 'missing-start-date') {
      toast.error(t('pages.create.event.timeSeries.validation.startDateRequired'));
      return;
    }

    if (timeSeriesValidationError === 'missing-weekdays') {
      toast.error(t('pages.create.event.timeSeries.validation.weekdaysRequired'));
      return;
    }

    if (processSchedulingValidationMessage) {
      toast.error(processSchedulingValidationMessage);
      return;
    }

    setIsSubmitting(true);
    try {
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
      for (const task of matchingProcessTasks) {
        if (attachedTaskIds.has(task.id)) {
          continue;
        }

        attachedTaskIds.add(task.id);
        await attachProcessTaskToEvent({
          task,
          event: createdEvent,
          description:
            task.description?.trim() ||
            `Automatisch mit dem neuen Event "${title.trim()}" verknuepft.`,
          completeProcessTaskWithEvent,
        });
      }

      if (searchParams.returnTo) {
        window.location.assign(searchParams.returnTo);
        return;
      }

      navigate({ to: `/event/${eventId}` });
    } catch {
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'event',
      title: 'pages.create.event.title',
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        // 1. Basic Info first — title, description, image
        {
          label: t('pages.create.event.basicInfo'),
          isValid: () => !!title.trim(),
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.event.titleLabel')}
                required
                hint={t('pages.create.event.tips.title')}
                value={title}
                onValueChange={setTitle}
                placeholder={t('pages.create.event.titlePlaceholder')}
              />
              <div className="space-y-2">
                <FormControlLabel>{t('pages.create.event.descriptionLabel')}</FormControlLabel>
                <p className="text-muted-foreground text-xs">
                  {t('pages.create.event.tips.description')}
                </p>
                <MiniPlateEditor
                  value={descriptionContent}
                  onChange={handleDescriptionContentChange}
                  placeholder={t('pages.create.event.descriptionPlaceholder')}
                />
              </div>
              <ImageUpload
                currentImage={imageURL}
                onImageChange={(url: string) => setImageURL(url)}
                cleanupOnRemove
                entityType="events"
                entityId={eventId}
                label={t('pages.create.event.imageLabel')}
                description={t('pages.create.event.imageDescription')}
              />
            </div>
          ),
        },
        // 2. Event Type
        {
          label: t('pages.create.event.eventType'),
          isValid: () => true,
          content: <EventTypeInput value={eventType} onChange={setEventType} />,
        },
        ...(isMeetingEvent
          ? [
              {
                label: t('pages.create.event.meetingSettings'),
                isValid: () => normalizedMeetingBookings > 0,
                content: (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FormControlLabel>{t('pages.create.event.meetingFormat')}</FormControlLabel>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={meetingType === 'one-on-one' ? 'default' : 'outline'}
                          onClick={() => setMeetingType('one-on-one')}
                        >
                          {t('pages.create.event.meetingFormats.oneOnOne')}
                        </Button>
                        <Button
                          type="button"
                          variant={meetingType === 'public-meeting' ? 'default' : 'outline'}
                          onClick={() => setMeetingType('public-meeting')}
                        >
                          {t('pages.create.event.meetingFormats.publicMeeting')}
                        </Button>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {meetingType === 'public-meeting'
                          ? t('pages.create.event.meetingFormats.publicMeetingDesc')
                          : t('pages.create.event.meetingFormats.oneOnOneDesc')}
                      </p>
                    </div>
                    {meetingType === 'public-meeting' ? (
                      <CreateInputField
                        label={t('pages.create.event.bookingLimit')}
                        hint={t('pages.create.event.bookingLimitHint')}
                        type="number"
                        value={meetingMaxBookings}
                        onValueChange={setMeetingMaxBookings}
                        placeholder={t('pages.create.event.bookingLimitPlaceholder')}
                        min={1}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {t('pages.create.event.meetingFormats.oneOnOneLimit')}
                      </p>
                    )}
                  </div>
                ),
              },
            ]
          : []),
        // 3. Associated Group
        {
          label: t('pages.create.event.associatedGroup'),
          isValid: () => (groupRequired ? !!groupId : true),
          optional: !groupRequired,
          content: (
            <div className="space-y-4">
              <CreateTypeaheadField
                label={t('pages.create.event.associatedGroupLabel')}
                hint={t('pages.create.event.tips.group')}
                required={groupRequired}
                entityTypes={['group']}
                value={groupId || undefined}
                onChange={item => {
                  const nextGroupId = item?.id ?? '';
                  setGroupId(nextGroupId);
                  setGroupName(item?.label ?? '');
                  syncGroupSearch(nextGroupId);
                }}
                filterFn={item => activeGroupIds.has(item.id)}
                placeholder={t('pages.create.event.associatedGroupPlaceholder')}
              />
            </div>
          ),
        },
        // 4. Delegate Allocation (only for delegate_assembly)
        ...(eventType === 'delegate_assembly'
          ? [
              {
                label: t('pages.create.event.delegateAllocation'),
                isValid: () => true,
                content: (
                  <div className="space-y-4">
                    <DelegateAllocationInput value={delegateConfig} onChange={setDelegateConfig} />
                    <ElectionModeInput
                      value={delegateElectionMode}
                      onChange={setDelegateElectionMode}
                      label={translateText('generated.inline.0325_delegiertenwahl_f860c1a3')}
                      hint={translateText(
                        'generated.inline.0326_dieser_modus_wird_als_default_fuer_untergrupp_c5a2f055'
                      )}
                      descriptions={{
                        list: 'Untergruppen vergeben mehrere Stimmen in einer Listenwahl.',
                        single: 'Untergruppen legen pro Delegiertensitz eine eigene Wahl an.',
                      }}
                    />
                  </div>
                ),
              },
            ]
          : []),
        // 5. Date, time, recurrence, and time-based deadlines
        {
          label: t('pages.create.event.timeSeries.tabLabel'),
          isValid: () =>
            timeSeriesValidationError === null && processSchedulingValidationMessage === null,
          content: (
            <EventTimeSeriesSection
              startDate={startDate}
              startTime={startTime}
              endDate={endDate}
              endTime={endTime}
              onDateTimeChange={(field, value) => {
                if (field === 'startDate') setStartDate(value);
                else if (field === 'startTime') setStartTime(value);
                else if (field === 'endDate') setEndDate(value);
                else if (field === 'endTime') setEndTime(value);
              }}
              recurrencePattern={recurrencePattern}
              onRecurrencePatternChange={setRecurrencePattern}
              recurrenceEndDate={recurrenceEndDate}
              onRecurrenceEndDateChange={setRecurrenceEndDate}
              recurrenceInterval={recurrenceInterval}
              onRecurrenceIntervalChange={setRecurrenceInterval}
              recurrenceWeekdays={recurrenceWeekdays}
              onRecurrenceWeekdaysChange={setRecurrenceWeekdays}
              schedulingWindowMessage={processSchedulingWindowMessage}
              validationMessage={combinedTimeSeriesValidationMessage}
              minDate={searchParams.minStartDate}
              maxDate={searchParams.maxStartDate}
              deadlines={[
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
              ]}
            />
          ),
        },
        // 6. Location (tabbed: Physical / Online)
        {
          label: t('pages.create.event.location'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <div className="space-y-2">
                <FormControlLabel>
                  {translateText('generated.inline.0327_attendance_mode_507f30a9')}
                </FormControlLabel>
                <div className="flex flex-wrap gap-2">
                  {(['online', 'hybrid', 'offline'] as const).map(mode => (
                    <Button
                      key={mode}
                      type="button"
                      variant={attendanceMode === mode ? 'default' : 'outline'}
                      onClick={() => setAttendanceMode(mode)}
                    >
                      {mode === 'online'
                        ? translateText('generated.inline.0046_online_c3e839df')
                        : mode === 'hybrid'
                          ? translateText('generated.inline.0047_hybrid_8e01f6bc')
                          : translateText('generated.inline.0048_offline_e01fa717')}
                    </Button>
                  ))}
                </div>
              </div>
              {attendanceMode !== 'online' ? (
                <div className="space-y-4 rounded-xl border p-4">
                  <CreateInputField
                    label={t('pages.create.event.venueName')}
                    hint={t('pages.create.event.tips.venueName')}
                    value={locationName}
                    onValueChange={setLocationName}
                    placeholder={t('pages.create.event.venueNamePlaceholder')}
                  />
                  <GeoAddressPicker
                    idPrefix="create-event-location"
                    values={{
                      country,
                      region,
                      city,
                      post_code: postCode,
                      street,
                      house_number: houseNumber,
                    }}
                    coordinates={
                      latitude !== null && longitude !== null ? { latitude, longitude } : null
                    }
                    onCoordinatesChange={coordinates => {
                      setLatitude(coordinates?.latitude ?? null);
                      setLongitude(coordinates?.longitude ?? null);
                    }}
                    onFieldChange={(field, value) => {
                      switch (field) {
                        case 'country':
                          setCountry(value);
                          break;
                        case 'region':
                          setRegion(value);
                          break;
                        case 'city':
                          setCity(value);
                          break;
                        case 'post_code':
                          setPostCode(value);
                          break;
                        case 'street':
                          setStreet(value);
                          break;
                        case 'house_number':
                          setHouseNumber(value);
                          break;
                      }
                    }}
                    labels={{
                      country: t('pages.create.event.country'),
                      region: t('pages.create.event.region'),
                      city: t('pages.create.event.city'),
                      post_code: t('pages.create.event.postalCode'),
                      street: t('pages.create.event.street'),
                      house_number: t('pages.create.event.houseNumber'),
                    }}
                    placeholders={{
                      country: t('pages.create.event.country'),
                      region: t('pages.create.event.region'),
                      city: t('pages.create.event.city'),
                      post_code: t('pages.create.event.postalCode'),
                      street: t('pages.create.event.street'),
                      house_number: t('pages.create.event.houseNumber'),
                    }}
                  />
                </div>
              ) : null}
              {attendanceMode !== 'offline' ? (
                <div className="space-y-4 rounded-xl border p-4">
                  <CreateInputField
                    label={t('pages.create.event.meetingLink')}
                    hint={t('pages.create.event.tips.meetingLink')}
                    value={onlineLink}
                    onValueChange={setOnlineLink}
                    placeholder={t('pages.create.event.meetingLinkPlaceholder')}
                  />
                </div>
              ) : null}
              {!isMeetingEvent && (
                <CreateInputField
                  label={t('pages.create.event.capacityLabel')}
                  hint={t('pages.create.event.tips.capacity')}
                  type="number"
                  value={capacity}
                  onValueChange={setCapacity}
                  placeholder={t('pages.create.event.capacityPlaceholder')}
                  min={1}
                />
              )}
            </div>
          ),
        },
        // 7. Settings
        {
          label: t('pages.create.event.settings'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              {!isMeetingEvent && <VisibilityInput value={visibility} onChange={setVisibility} />}
              <HashtagEditor
                value={hashtags}
                onChange={setHashtags}
                placeholder={t('pages.create.event.hashtagPlaceholder')}
              />
            </div>
          ),
        },
        // 8. Review
        {
          label: t('pages.create.common.review'),
          isValid: () =>
            !!title.trim() &&
            hasRequiredDateTimeRange &&
            timeSeriesValidationError === null &&
            processSchedulingValidationMessage === null,
          content: (
            <CreateSummaryStep
              entityType="event"
              badge={t('pages.create.event.reviewBadge')}
              secondaryBadge={eventTypeLabel}
              title={title || t('pages.create.event.titlePlaceholder')}
              subtitle={description || undefined}
              media={
                imageURL
                  ? { imageUrl: imageURL, imageAlt: title || 'Event cover image' }
                  : undefined
              }
              hashtags={hashtags.length > 0 ? hashtags : undefined}
              sections={[
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
                            label: translateText('generated.inline.0057_delegiertenwahl_f860c1a3'),
                            value: delegateElectionModeLabel,
                          },
                        ]
                      : []),
                    {
                      label: t('pages.create.common.visibility'),
                      value: visibilityLabel,
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
                  ],
                },
              ]}
            />
          ),
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
      hashtags,
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
