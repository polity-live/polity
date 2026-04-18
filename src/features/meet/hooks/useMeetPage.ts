import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useMeetingsByCreator, getInstanceBookingCount, isBookedByUser } from '@/zero/events';
import { useMeetingActions } from '@/zero/events/useMeetingActions';
import { useEventActions } from '@/zero/events/useEventActions';
import { generateRecurringInstances } from '@/features/calendar/logic/recurringEventHelpers';
import { buildRRule, type RecurrenceFormState } from '@/features/events/logic/rruleHelpers';
import type { CalendarViewMode } from '@/features/events/hooks/useCalendarView';
import { addHours } from 'date-fns';
import {
  isSameDay,
  isDateInRange,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  formatWeekRange,
  formatMonth,
} from '@/features/meet/logic/date-helpers.ts';

export type CalendarView = CalendarViewMode;

export interface MeetingInstance {
  id: string;
  parentEventId: string;
  title: string;
  description: string | null;
  meetingType: string | null;
  startDate: number;
  endDate: number;
  isBookable: boolean;
  maxBookings: number;
  bookingCount: number;
  isBookedByMe: boolean;
  isRecurringInstance: boolean;
  instanceDate: number | null;
  locationName: string | null;
  locationUrl: string | null;
  streamUrl: string | null;
  participants: {
    id: string;
    user_id: string;
    instance_date?: number | null;
    user?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      avatar?: string | null;
    } | null;
  }[];
  creator?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar?: string | null;
  } | null;
}

interface CreateMeetingArgs {
  title: string;
  description: string;
  meetingType: 'one-on-one' | 'public-meeting';
  startDate: Date;
  durationMinutes: number;
  maxBookings: number;
  isRecurring: boolean;
  recurrence?: RecurrenceFormState;
  location?: string;
  locationUrl?: string;
}

interface UpdateMeetingArgs {
  id: string;
  title: string;
  description: string;
  meetingType: 'one-on-one' | 'public-meeting';
  startDate: Date;
  durationMinutes: number;
  maxBookings: number;
  location?: string;
  locationUrl?: string;
}

export function useMeetPage(userId: string) {
  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.id === userId;
  const { meetings, isLoading } = useMeetingsByCreator(userId);
  const meetingActions = useMeetingActions();
  const eventActions = useEventActions();

  // Calendar view state
  const [view, setView] = useState<CalendarView>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<MeetingInstance | null>(null);

  // Expand all meetings (recurring + one-time) into instances within a generous window
  const allInstances = useMemo(() => {
    const rangeStart = view === 'list' ? new Date() : new Date(selectedDate);
    const rangeEnd = view === 'list' ? new Date() : new Date(selectedDate);

    if (view === 'list') {
      rangeStart.setFullYear(rangeStart.getFullYear() - 1);
      rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);
    } else {
      rangeStart.setMonth(rangeStart.getMonth() - 1);
      rangeEnd.setMonth(rangeEnd.getMonth() + 3);
    }

    const instances: MeetingInstance[] = [];

    for (const meeting of meetings) {
      const expanded = generateRecurringInstances(meeting, rangeStart, rangeEnd, [
        ...(meeting.exceptions ?? []),
      ]);

      for (const inst of expanded) {
        const instDateMs = inst.isRecurringInstance ? inst.start_date : null;
        const participants = [...(meeting.participants ?? [])] as MeetingInstance['participants'];
        const bookingCount = getInstanceBookingCount(participants, meeting.creator_id, instDateMs);
        const bookedByMe = currentUser
          ? isBookedByUser(participants, currentUser.id, instDateMs)
          : false;

        instances.push({
          id: inst.id,
          parentEventId: meeting.id,
          title: inst.title ?? 'Meeting',
          description: inst.description ?? null,
          meetingType: meeting.meeting_type ?? null,
          startDate: inst.start_date ?? 0,
          endDate: inst.end_date ?? 0,
          isBookable: meeting.is_bookable,
          maxBookings: meeting.max_bookings ?? 1,
          bookingCount,
          isBookedByMe: bookedByMe,
          isRecurringInstance: !!inst.isRecurringInstance,
          instanceDate: instDateMs,
          locationName: inst.location_name ?? meeting.location_name ?? null,
          locationUrl: inst.location_url ?? meeting.location_url ?? null,
          streamUrl: meeting.stream_url ?? null,
          participants,
          creator: meeting.creator as MeetingInstance['creator'],
        });
      }
    }

    return instances.sort((a, b) => a.startDate - b.startDate);
  }, [meetings, selectedDate, currentUser, view]);

  // Filter instances based on current view
  const filteredInstances = useMemo(() => {
    if (view === 'list') {
      return allInstances;
    }

    if (view === 'week') {
      const start = startOfWeek(selectedDate);
      const end = endOfWeek(selectedDate);
      return allInstances.filter(inst => isDateInRange(inst.startDate, start, end));
    }
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    return allInstances.filter(inst => isDateInRange(inst.startDate, start, end));
  }, [allInstances, view, selectedDate]);

  // Get instances for a specific date
  const getInstancesForDate = useCallback(
    (date: Date) => allInstances.filter(inst => isSameDay(inst.startDate, date)),
    [allInstances]
  );

  // Navigation
  const goToPrevious = useCallback(() => {
    setSelectedDate(prev => {
      if (view === 'list') return prev;

      const d = new Date(prev);
      if (view === 'week') d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, [view]);

  const goToNext = useCallback(() => {
    setSelectedDate(prev => {
      if (view === 'list') return prev;

      const d = new Date(prev);
      if (view === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, [view]);

  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  const currentViewTitle = useMemo(() => {
    if (view === 'list') return 'All meeting offers';
    if (view === 'week') return formatWeekRange(selectedDate);
    return formatMonth(selectedDate);
  }, [view, selectedDate]);

  // Handlers
  const handleBookMeeting = useCallback(
    async (instance: MeetingInstance) => {
      await meetingActions.bookMeeting(instance.parentEventId, instance.instanceDate);
      setIsBookingDialogOpen(false);
      setSelectedInstance(null);
    },
    [meetingActions]
  );

  const handleCancelBooking = useCallback(
    async (instance: MeetingInstance) => {
      await meetingActions.cancelMeetingBooking(instance.parentEventId, instance.instanceDate);
    },
    [meetingActions]
  );

  const handleCreateMeeting = useCallback(
    async (args: CreateMeetingArgs) => {
      const creatorId = currentUser?.id;
      if (!creatorId) return;

      const endDate = addHours(args.startDate, args.durationMinutes / 60);
      const id = crypto.randomUUID();

      let recurrenceRule: string | null = null;
      let isRecurring = args.isRecurring;
      let recurrencePattern: string | null = null;
      let recurrenceEndDate: number | null = null;

      if (args.isRecurring && args.recurrence) {
        recurrenceRule = buildRRule(args.recurrence);
        recurrencePattern = args.recurrence.pattern;
        recurrenceEndDate = args.recurrence.endDate
          ? new Date(args.recurrence.endDate).getTime()
          : null;
        if (!recurrenceRule) isRecurring = false;
      }

      await eventActions.createEvent({
        id,
        title: args.title.trim(),
        group_id: null,
        description: args.description.trim() || null,
        status: 'published',
        event_type: 'meeting',
        visibility: args.meetingType === 'public-meeting' ? 'public' : 'private',
        meeting_type: args.meetingType,
        is_bookable: true,
        max_bookings: args.maxBookings,
        start_date: args.startDate.getTime(),
        end_date: endDate.getTime(),
        is_recurring: isRecurring,
        recurrence_rule: recurrenceRule,
        recurrence_pattern: recurrencePattern,
        recurrence_end_date: recurrenceEndDate,
        location_name: args.location?.trim() || null,
        location_url: args.locationUrl?.trim() || null,
        creator_id: creatorId,
      });

      setIsCreateDialogOpen(false);
    },
    [eventActions, currentUser]
  );

  const handleDeleteMeeting = useCallback(
    async (eventId: string) => {
      await eventActions.cancelEvent({ id: eventId, cancel_reason: 'Deleted by owner' });
    },
    [eventActions]
  );

  const handleUpdateMeeting = useCallback(
    async (args: UpdateMeetingArgs) => {
      const endDate = addHours(args.startDate, args.durationMinutes / 60);

      await eventActions.updateEvent({
        id: args.id,
        title: args.title.trim(),
        description: args.description.trim() || null,
        visibility: args.meetingType === 'public-meeting' ? 'public' : 'private',
        meeting_type: args.meetingType,
        max_bookings: args.maxBookings,
        start_date: args.startDate.getTime(),
        end_date: endDate.getTime(),
        location_name: args.location?.trim() || null,
        location_url: args.locationUrl?.trim() || null,
      });
    },
    [eventActions]
  );

  const openBookingDialog = useCallback((instance: MeetingInstance) => {
    setSelectedInstance(instance);
    setIsBookingDialogOpen(true);
  }, []);

  return {
    // Auth state
    currentUser,
    isOwner,
    isLoading,
    owner: meetings[0]?.creator ?? null,

    // Calendar view
    view,
    setView,
    selectedDate,
    setSelectedDate,
    currentViewTitle,
    goToPrevious,
    goToNext,
    goToToday,

    // Data
    meetings,
    allInstances,
    filteredInstances,
    getInstancesForDate,

    // Dialogs
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isBookingDialogOpen,
    setIsBookingDialogOpen,
    selectedInstance,
    setSelectedInstance,

    // Handlers
    handleBookMeeting,
    handleCancelBooking,
    handleCreateMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
    openBookingDialog,
  };
}
