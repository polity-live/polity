import { useState, useEffect, useRef } from 'react';
import type { Value } from 'platejs';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useEventData } from './useEventData';
import { useEventMutations } from './useEventMutations';
import { useEventActions } from '@/zero/events/useEventActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useAuth } from '@/providers/auth-provider';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { buildRecurringEventFields } from '@/features/events/logic/buildRecurringEventFields';
import { buildEventTemporalFields } from '@/features/events/logic/buildEventTemporalFields';
import { getEventTimeSeriesValidationError } from '@/features/events/logic/eventTimeSeriesValidation';
import {
  parseRRuleToFormState,
  type RecurrencePattern,
} from '@/features/events/logic/rruleHelpers';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toRichTextValue,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import {
  formatLocalDateInput,
  formatLocalTimeInput,
  formatLocalDateTimeInput,
  getIsoWeekdayIndex,
} from '@/features/shared/logic/localDateTime';
import {
  normalizeDelegateElectionMode,
  type ElectionMode,
} from '@/features/elections/logic/electionMode';
import { isPositiveInteger } from '@/features/shared/logic/inputValidation';
import {
  DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
  normalizeChangeRequestVoteOrder,
  type ChangeRequestVoteOrder,
} from '@/features/change-requests/logic/changeRequestVoteOrder';

type AttendanceMode = 'online' | 'hybrid' | 'offline';

export interface EventFormData {
  title: string;
  description: string;
  descriptionContent: Value;
  attendanceMode: AttendanceMode;
  locationName: string;
  onlineLink: string;
  country: string;
  region: string;
  postCode: string;
  city: string;
  street: string;
  houseNumber: string;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  capacity: string;
  groupId: string;
  imageURL: string;
  visibility: Visibility;
  tags: string[];
  registrationDeadline: string;
  amendmentDeadline: string;
  candidacyDeadline: string;
  delegatesNominationDeadline: string;
  delegateAllocationMode: 'ratio' | 'total';
  delegateTotalSeats: string;
  delegateMembersPerSeat: string;
  delegateElectionMode: ElectionMode;
  defaultFinalVoteDurationMinutes: string;
  genderQuotaEnabled: boolean;
  changeRequestVoteOrder: ChangeRequestVoteOrder;
  recurrencePattern: RecurrencePattern;
  recurrenceInterval: number;
  recurrenceWeekdays: number[];
  recurrenceEndDate: string;
}

const RECURRENCE_PATTERNS: RecurrencePattern[] = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'four-yearly',
];

function normalizeRecurrencePattern(value: string | null | undefined): RecurrencePattern {
  return RECURRENCE_PATTERNS.includes(value as RecurrencePattern)
    ? (value as RecurrencePattern)
    : 'none';
}

function resolveAttendanceMode(event: {
  attendance_mode?: string | null;
  location_type?: string | null;
}) {
  if (event.attendance_mode === 'online' || event.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event.location_type === 'online' ? 'online' : 'offline';
}

/**
 * Hook for event create/update functionality
 */
export function useEventUpdate(eventId: string, mode: 'create' | 'edit' = 'edit') {
  const navigate = useNavigate();
  const isCreating = mode === 'create';
  const { user } = useAuth();
  const { t } = useTranslation();

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    descriptionContent: EMPTY_RICH_TEXT_VALUE,
    attendanceMode: 'offline',
    locationName: '',
    onlineLink: '',
    country: '',
    region: '',
    postCode: '',
    city: '',
    street: '',
    houseNumber: '',
    latitude: null,
    longitude: null,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    capacity: '',
    groupId: '',
    imageURL: '',
    visibility: 'public' as Visibility,
    tags: [],
    registrationDeadline: '',
    amendmentDeadline: '',
    candidacyDeadline: '',
    delegatesNominationDeadline: '',
    delegateAllocationMode: 'ratio',
    delegateTotalSeats: '',
    delegateMembersPerSeat: '10',
    delegateElectionMode: 'list',
    defaultFinalVoteDurationMinutes: '',
    genderQuotaEnabled: false,
    changeRequestVoteOrder: DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
    recurrencePattern: 'none',
    recurrenceInterval: 1,
    recurrenceWeekdays: [],
    recurrenceEndDate: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Always call the hook but pass undefined in create mode so no query fires
  const { event, isLoading: editLoading } = useEventData(isCreating ? undefined : eventId);
  const isLoading = isCreating ? false : editLoading;
  const { updateEvent } = useEventMutations(eventId);
  const { createEvent, updateEvent: updateEventAction } = useEventActions();
  const commonActions = useCommonActions();
  const { eventHashtags, allHashtags } = useCommonState({
    event_id: eventId,
    loadAllHashtags: true,
  });

  const initializedRef = useRef(false);
  const hashtagsInitializedRef = useRef(false);

  // Initialize hashtags from junction data once available
  useEffect(() => {
    if (eventHashtags && eventHashtags.length > 0 && !hashtagsInitializedRef.current) {
      hashtagsInitializedRef.current = true;
      const tags = eventHashtags.map(j => j.hashtag?.tag).filter((t): t is string => !!t);
      setFormData(prev => ({ ...prev, tags }));
    }
  }, [eventHashtags]);

  // Initialize form data only once when event first loads
  useEffect(() => {
    if (event && !initializedRef.current) {
      initializedRef.current = true;
      let recurrencePattern: RecurrencePattern = 'none';
      let recurrenceInterval = 1;
      let recurrenceWeekdays: number[] = [];
      let recurrenceEndDate = '';

      if (event.is_recurring) {
        try {
          const parsedRecurrence = event.recurrence_rule
            ? parseRRuleToFormState(event.recurrence_rule)
            : null;

          if (parsedRecurrence) {
            recurrencePattern = parsedRecurrence.pattern;
            recurrenceInterval = parsedRecurrence.interval;
            recurrenceWeekdays = [...parsedRecurrence.weekdays];
            recurrenceEndDate = parsedRecurrence.endDate ?? '';
          } else {
            recurrencePattern = normalizeRecurrencePattern(event.recurrence_pattern);
            recurrenceInterval = event.recurrence_interval ?? 1;
            recurrenceWeekdays = Array.isArray(event.recurrence_days)
              ? [...event.recurrence_days].sort((left, right) => left - right)
              : [];
            recurrenceEndDate = formatLocalDateInput(event.recurrence_end_date);
          }
        } catch {
          recurrencePattern = normalizeRecurrencePattern(event.recurrence_pattern);
          recurrenceInterval = event.recurrence_interval ?? 1;
          recurrenceWeekdays = Array.isArray(event.recurrence_days)
            ? [...event.recurrence_days].sort((left, right) => left - right)
            : [];
          recurrenceEndDate = formatLocalDateInput(event.recurrence_end_date);
        }

        if (recurrencePattern === 'weekly' && recurrenceWeekdays.length === 0 && event.start_date) {
          recurrenceWeekdays = [getIsoWeekdayIndex(event.start_date)];
        }
      }

      setFormData({
        title: event.title || '',
        description: richTextToPlainText(event.description ?? ''),
        descriptionContent: toRichTextValue(event.description ?? ''),
        attendanceMode: resolveAttendanceMode(event),
        locationName: event.location_name || '',
        onlineLink: event.location_url || '',
        country: event.country || '',
        region: event.region || '',
        postCode: event.post_code || '',
        city: event.city || '',
        street: event.street || '',
        houseNumber: event.house_number || '',
        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,
        startDate: formatLocalDateInput(event.start_date),
        startTime: formatLocalTimeInput(event.start_date),
        endDate: formatLocalDateInput(event.end_date),
        endTime: formatLocalTimeInput(event.end_date),
        capacity: event.capacity?.toString() || '',
        groupId: event.group_id || '',
        imageURL: event.image_url || '',
        visibility: (event.visibility as Visibility) ?? 'public',
        tags: [],
        registrationDeadline: formatLocalDateTimeInput(event.registration_deadline),
        amendmentDeadline: formatLocalDateTimeInput(event.amendment_deadline),
        candidacyDeadline: formatLocalDateTimeInput(event.candidacy_deadline),
        delegatesNominationDeadline: formatLocalDateTimeInput(event.delegates_nomination_deadline),
        delegateAllocationMode:
          event.delegate_seat_allocation_type === 'fixed_total' || event.total_delegate_seats
            ? 'total'
            : 'ratio',
        delegateTotalSeats: event.total_delegate_seats?.toString() || '',
        delegateMembersPerSeat:
          event.main_group_delegate_allocation_mode &&
          !Number.isNaN(Number.parseInt(event.main_group_delegate_allocation_mode, 10))
            ? String(Math.max(1, Number.parseInt(event.main_group_delegate_allocation_mode, 10)))
            : '10',
        delegateElectionMode: normalizeDelegateElectionMode(event.delegate_election_mode),
        defaultFinalVoteDurationMinutes: event.default_final_vote_duration_seconds
          ? String(Math.max(1, Math.round(event.default_final_vote_duration_seconds / 60)))
          : '',
        genderQuotaEnabled: Boolean(event.gender_quota_enabled),
        changeRequestVoteOrder: normalizeChangeRequestVoteOrder(event.change_request_vote_order),
        recurrencePattern,
        recurrenceInterval,
        recurrenceWeekdays,
        recurrenceEndDate,
      });
    }
  }, [event]);

  // Update a single field
  const updateField = <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateDescriptionContent = (value: Value) => {
    setFormData(prev => ({
      ...prev,
      description: richTextToPlainText(value),
      descriptionContent: value,
    }));
  };

  const timeSeriesValidationError = getEventTimeSeriesValidationError({
    startDate: formData.startDate,
    recurrencePattern: formData.recurrencePattern,
    recurrenceWeekdays: formData.recurrenceWeekdays,
  });

  const removeImage = () => {
    if (isCreating) {
      return;
    }

    updateEventAction({
      id: eventId,
      image_url: null,
    });
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (timeSeriesValidationError === 'missing-start-date') {
        toast.error(t('features.events.editPage.timeSeries.validation.startDateRequired'));
        return;
      }

      if (timeSeriesValidationError === 'missing-weekdays') {
        toast.error(t('features.events.editPage.timeSeries.validation.weekdaysRequired'));
        return;
      }

      if (
        formData.defaultFinalVoteDurationMinutes.trim() &&
        !isPositiveInteger(formData.defaultFinalVoteDurationMinutes)
      ) {
        toast.error(translateText('features.events.editPage.finalVoteDurationInvalid'));
        return;
      }

      const recurringFields = buildRecurringEventFields({
        isRecurring: formData.recurrencePattern !== 'none',
        recurrence: {
          pattern: formData.recurrencePattern,
          interval: formData.recurrenceInterval,
          weekdays: formData.recurrenceWeekdays,
          endDate: formData.recurrenceEndDate || null,
        },
      });
      const {
        start_date,
        end_date,
        registration_deadline,
        amendment_deadline,
        candidacy_deadline,
        delegates_nomination_deadline,
      } = buildEventTemporalFields({
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate,
        endTime: formData.endTime,
        registrationDeadline: formData.registrationDeadline,
        amendmentDeadline: formData.amendmentDeadline,
        candidacyDeadline: formData.candidacyDeadline,
        delegatesNominationDeadline: formData.delegatesNominationDeadline,
      });
      const defaultFinalVoteDurationSeconds = formData.defaultFinalVoteDurationMinutes.trim()
        ? Math.max(1, Number.parseInt(formData.defaultFinalVoteDurationMinutes, 10) || 1) * 60
        : null;

      if (isCreating) {
        if (!user?.id) {
          toast.error(
            translateText('generated.inline.0477_you_must_be_logged_in_to_create_an_event_9cd6fe1e')
          );
          return;
        }

        const createData = {
          id: eventId,
          title: formData.title,
          description: formData.description
            ? toZeroRichTextValue(formData.descriptionContent)
            : null,
          attendance_mode: formData.attendanceMode,
          location_type: formData.attendanceMode === 'online' ? 'online' : 'physical',
          location_name:
            formData.attendanceMode !== 'online' ? formData.locationName || null : null,
          location_url: formData.attendanceMode !== 'offline' ? formData.onlineLink || null : null,
          country: formData.attendanceMode !== 'online' ? formData.country || null : null,
          region: formData.attendanceMode !== 'online' ? formData.region || null : null,
          post_code: formData.attendanceMode !== 'online' ? formData.postCode || null : null,
          city: formData.attendanceMode !== 'online' ? formData.city || null : null,
          street: formData.attendanceMode !== 'online' ? formData.street || null : null,
          house_number: formData.attendanceMode !== 'online' ? formData.houseNumber || null : null,
          latitude: formData.attendanceMode !== 'online' ? formData.latitude : null,
          longitude: formData.attendanceMode !== 'online' ? formData.longitude : null,
          start_date,
          end_date,
          visibility: formData.visibility,
          image_url: formData.imageURL || null,
          capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
          group_id: formData.groupId || null,
          creator_id: user.id,
          delegates_nomination_deadline,
          has_delegates: event?.event_type === 'delegate_assembly',
          delegate_seat_allocation_type:
            event?.event_type === 'delegate_assembly'
              ? formData.delegateAllocationMode === 'total'
                ? 'fixed_total'
                : 'members_per_delegate'
              : null,
          total_delegate_seats:
            event?.event_type === 'delegate_assembly' && formData.delegateAllocationMode === 'total'
              ? Math.max(1, Number.parseInt(formData.delegateTotalSeats, 10) || 1)
              : null,
          main_group_delegate_allocation_mode:
            event?.event_type === 'delegate_assembly' && formData.delegateAllocationMode === 'ratio'
              ? String(Math.max(1, Number.parseInt(formData.delegateMembersPerSeat, 10) || 1))
              : null,
          delegate_election_mode:
            event?.event_type === 'delegate_assembly' ? formData.delegateElectionMode : null,
          default_final_vote_duration_seconds: defaultFinalVoteDurationSeconds,
          gender_quota_enabled: formData.genderQuotaEnabled,
          change_request_vote_order: formData.changeRequestVoteOrder,
          ...recurringFields,
        };

        await createEvent(createData);
      } else {
        if (!event) {
          toast.error(translateText('generated.inline.0478_no_event_data_to_update_e4627a29'));
          return;
        }

        const updateData = {
          id: eventId,
          title: formData.title,
          description: formData.description
            ? toZeroRichTextValue(formData.descriptionContent)
            : null,
          attendance_mode: formData.attendanceMode,
          location_type: formData.attendanceMode === 'online' ? 'online' : 'physical',
          location_name:
            formData.attendanceMode !== 'online' ? formData.locationName || null : null,
          location_url: formData.attendanceMode !== 'offline' ? formData.onlineLink || null : null,
          country: formData.attendanceMode !== 'online' ? formData.country || null : null,
          region: formData.attendanceMode !== 'online' ? formData.region || null : null,
          post_code: formData.attendanceMode !== 'online' ? formData.postCode || null : null,
          city: formData.attendanceMode !== 'online' ? formData.city || null : null,
          street: formData.attendanceMode !== 'online' ? formData.street || null : null,
          house_number: formData.attendanceMode !== 'online' ? formData.houseNumber || null : null,
          latitude: formData.attendanceMode !== 'online' ? formData.latitude : null,
          longitude: formData.attendanceMode !== 'online' ? formData.longitude : null,
          start_date,
          end_date,
          visibility: formData.visibility,
          image_url: formData.imageURL || null,
          capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
          group_id: formData.groupId || null,
          registration_deadline,
          amendment_deadline,
          candidacy_deadline,
          delegates_nomination_deadline,
          has_delegates: event.event_type === 'delegate_assembly',
          delegate_seat_allocation_type:
            event.event_type === 'delegate_assembly'
              ? formData.delegateAllocationMode === 'total'
                ? 'fixed_total'
                : 'members_per_delegate'
              : null,
          total_delegate_seats:
            event.event_type === 'delegate_assembly' && formData.delegateAllocationMode === 'total'
              ? Math.max(1, Number.parseInt(formData.delegateTotalSeats, 10) || 1)
              : null,
          main_group_delegate_allocation_mode:
            event.event_type === 'delegate_assembly' && formData.delegateAllocationMode === 'ratio'
              ? String(Math.max(1, Number.parseInt(formData.delegateMembersPerSeat, 10) || 1))
              : null,
          delegate_election_mode:
            event.event_type === 'delegate_assembly' ? formData.delegateElectionMode : null,
          default_final_vote_duration_seconds: defaultFinalVoteDurationSeconds,
          gender_quota_enabled: formData.genderQuotaEnabled,
          change_request_vote_order: formData.changeRequestVoteOrder,
          ...recurringFields,
        };

        await updateEvent(updateData);
      }

      // Sync hashtags via junction tables
      await commonActions.syncEntityHashtags(
        'event',
        eventId,
        formData.tags,
        eventHashtags ?? [],
        allHashtags ?? []
      );

      navigate({ to: `/event/${eventId}` });
    } catch (error) {
      console.error(isCreating ? 'Create error:' : 'Update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    updateField,
    updateDescriptionContent,
    timeSeriesValidationError,
    removeImage,
    handleSubmit,
    isSubmitting,
    event,
    isLoading,
    isCreating,
  };
}
