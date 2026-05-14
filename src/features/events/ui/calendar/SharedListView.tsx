import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { getBaseEventId } from '@/features/calendar/logic/eventIdUtils';
import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import { MeetupTimelineCard } from '@/features/timeline/ui/cards/MeetupTimelineCard';
import { SharedChronologicalListView } from './SharedChronologicalListView';

interface SharedListViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onEventSelect: (event: CalendarEvent) => void;
}

function toTimelineEvent(event: CalendarEvent) {
  return {
    id: getBaseEventId(event.id),
    title: event.title,
    description: event.description,
    startDate: new Date(event.start_date),
    endDate: event.end_date ? new Date(event.end_date) : undefined,
    location: event.location,
    attendeeCount: event.attendeeCount,
    organizerName: event.organizer?.name || event.organizerName,
    organizerId: event.organizer?.id,
    groupName: event.groupName ?? undefined,
    groupId: event.group_id ?? undefined,
    hashtags: event.hashtags,
  };
}

function toMeetupEvent(event: CalendarEvent) {
  return {
    id: getBaseEventId(event.id),
    title: event.title,
    description: event.description,
    startDate: event.start_date,
    endDate: event.end_date,
    meetingType: event.meeting_type,
    organizerName: event.organizer?.name || event.organizerName,
    location: event.location,
    onlineUrl: event.location_url ?? event.stream_url,
    bookingCount: event.bookingCount,
    maxBookings: event.max_bookings,
    isBookedByMe: event.isBookedByMe,
    isOwner: event.isOwner,
    isBookable: event.is_bookable,
  };
}

export function SharedListView({ events, selectedDate, onEventSelect }: SharedListViewProps) {
  const { t } = useTranslation();

  return (
    <SharedChronologicalListView
      items={events}
      selectedDate={selectedDate}
      getItemDate={event => event.start_date}
      getItemKey={event => event.id}
      emptyText={t('features.calendar.dayView.noEvents')}
      renderItem={event => {
        if (event.isMeeting) {
          return (
            <MeetupTimelineCard
              meetup={toMeetupEvent(event)}
              onSelect={() => onEventSelect(event)}
            />
          );
        }

        return (
          <EventTimelineCard event={toTimelineEvent(event)} onSelect={() => onEventSelect(event)} />
        );
      }}
    />
  );
}
