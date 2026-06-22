import { useMemo } from 'react';
import { addYears } from 'date-fns';
import { useAuth } from '@/providers/auth-provider';
import { useEventsForCalendarWithExceptions } from '@/zero/events/useEventState';
import { generateRecurringInstances } from '../logic/recurringEventHelpers';
import {
  isCalendarEventOwnedByUser,
  isCalendarEventVisibleToUser,
} from '../logic/calendarEventVisibility';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import type { CalendarEvent } from '../types/calendar.types';
import { getInstanceBookingCount, isBookedByUser } from '@/zero/events/useMeetingState';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';

export const useCalendarData = () => {
  const { user } = useAuth();

  const { events: eventsData } = useEventsForCalendarWithExceptions();

  const isLoading = false;

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    if (!eventsData || !user) return [];

    // Define a reasonable range for recurring events (±1 year from now)
    const now = new Date();
    const rangeStart = addYears(now, -1);
    const rangeEnd = addYears(now, 1);

    const userEvents = (eventsData || [])
      .filter(event => isCalendarEventVisibleToUser(event, user.id))
      .flatMap(event => {
        const isMeeting = !!event.meeting_type;
        const isOrganizer = isCalendarEventOwnedByUser(event, user.id);
        const participants = event.participants ?? [];
        // Expand recurring events into instances, passing exceptions
        const instances = generateRecurringInstances(event, rangeStart, rangeEnd, event.exceptions);
        return instances.map(instance => {
          const instanceDate = instance.isRecurringInstance ? instance.start_date : null;
          const bookingCount = isMeeting
            ? getInstanceBookingCount(participants, event.creator_id, instanceDate)
            : undefined;
          const bookedByMe = isMeeting
            ? isBookedByUser(participants, user.id, instanceDate)
            : undefined;

          const creatorName =
            [event.creator?.first_name, event.creator?.last_name].filter(Boolean).join(' ') ||
            undefined;
          return {
            ...instance,
            title: instance.title || '',
            start_date: instance.start_date ?? 0,
            end_date: instance.end_date ?? 0,
            location: formatNamedLocation(instance.location_name, instance) || undefined,
            location_url: instance.location_url ?? event.location_url ?? null,
            visibility: instance.visibility ?? 'public',
            image_url: instance.image_url,
            description: instance.description || '',
            organizer: event.creator
              ? {
                  id: event.creator.id,
                  name: creatorName,
                  avatar: event.creator.avatar ?? undefined,
                }
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
            isOwner: isOrganizer,
            meeting_type: event.meeting_type,
            is_bookable: event.is_bookable,
            max_bookings: event.max_bookings,
            bookingCount,
            isBookedByMe: bookedByMe,
            stream_url: event.stream_url ?? null,
          } as CalendarEvent;
        });
      });

    return userEvents;
  }, [eventsData, user]);

  return { events: calendarEvents, isLoading };
};
