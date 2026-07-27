import { useCallback, useMemo } from 'react';
import { addYears } from 'date-fns';
import { useNavigate } from '@tanstack/react-router';
import { useGroupEventsForCalendar } from '@/zero/events/useEventState';
import { useCalendarView, type CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { useCalendarEventFilter } from '@/features/events/hooks/useCalendarEventFilter';
import { generateRecurringInstances } from '@/features/calendar/logic/recurringEventHelpers';
import { getCalendarEventsForView } from '@/features/calendar/logic/listViewHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { useAuth } from '@/providers/auth-provider';
import { getInstanceBookingCount, isBookedByUser } from '@/zero/events/useMeetingState';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { toCreateEventSearch } from '@/features/create/logic/createEventSearch';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';

export function useGroupEventsPage(groupId: string) {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { events: eventsData } = useGroupEventsForCalendar(groupId);
  const calendar = useCalendarView('week');

  const events: CalendarEvent[] = useMemo(() => {
    if (!eventsData) return [];

    const now = new Date();
    const rangeStart = addYears(now, -1);
    const rangeEnd = addYears(now, 1);

    return (eventsData || []).flatMap(sourceEvent => {
      const event = resolveAppTutorialFixtureValue(sourceEvent, {
        tutorialRunId: sourceEvent.tutorial_run_id,
        language,
      });
      // Exclude bookable meetings from group event listings (shown in calendar instead)
      if (event.is_bookable) return [];
      const isMeeting = !!event.meeting_type;
      const participants = event.participants ?? [];
      const instances = generateRecurringInstances(event, rangeStart, rangeEnd, event.exceptions);
      return instances.map(instance => {
        const instanceDate = instance.isRecurringInstance ? instance.start_date : null;
        const bookingCount = isMeeting
          ? getInstanceBookingCount(participants, event.creator_id, instanceDate)
          : undefined;
        const bookedByMe =
          isMeeting && user ? isBookedByUser(participants, user.id, instanceDate) : undefined;

        const creatorName =
          [event.creator?.first_name, event.creator?.last_name].filter(Boolean).join(' ') ||
          undefined;
        return {
          ...instance,
          title: instance.title || '',
          start_date: instance.start_date ?? 0,
          end_date: instance.end_date ?? 0,
          location: formatNamedLocation(instance.location_name, instance) || undefined,
          visibility: instance.visibility ?? 'public',
          image_url: instance.image_url,
          description: instance.description || '',
          organizer: event.creator
            ? { id: event.creator.id, name: creatorName, avatar: event.creator.avatar ?? undefined }
            : undefined,
          participants: event.participants,
          groupName: event.group?.name,
          group_id: event.group_id,
          organizerName: event.group?.name || creatorName,
          attendeeCount: event.participants?.length,
          hashtags: extractHashtagTags(event.event_hashtags)?.map((tag: string) => ({
            id: tag,
            tag,
          })),
          isMeeting,
          meeting_type: event.meeting_type,
          is_bookable: event.is_bookable,
          max_bookings: event.max_bookings,
          bookingCount,
          isBookedByMe: bookedByMe,
        } as CalendarEvent;
      });
    });
  }, [eventsData, language, user]);

  const filter = useCalendarEventFilter(events);
  const filteredEvents = getCalendarEventsForView(
    calendar.viewMode,
    filter.filteredBySearch,
    calendar.filterEventsForRange
  );
  const onEventSelect = useCallback(
    (event: CalendarEvent) => {
      navigate({ to: '/event/$id', params: { id: event.id } });
    },
    [navigate]
  );
  const onCreateEventRange = useCallback(
    (range: { start: Date; end: Date }) => {
      navigate({
        to: '/create/event',
        search: toCreateEventSearch(range),
      });
    },
    [navigate]
  );

  return {
    t,
    events: filter.filteredBySearch,
    filteredEvents,
    searchQuery: filter.searchQuery,
    setSearchQuery: filter.setSearchQuery,
    dateFilter: filter.dateFilter,
    setDateFilter: filter.setDateFilter,
    onEventSelect,
    onCreateEventRange,
    ...calendar,
  };
}
