import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { CalendarIcon } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { getBaseEventId } from '@/features/calendar/logic/eventIdUtils';
import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import { MeetupTimelineCard } from '@/features/timeline/ui/cards/MeetupTimelineCard';

interface SharedListViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  for (const event of sorted) {
    const d = new Date(event.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const currentEvents = map.get(key);

    if (currentEvents) {
      currentEvents.push(event);
      continue;
    }

    map.set(key, [event]);
  }
  return map;
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
    organizerName: event.organizerName,
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

export function SharedListView({ events }: SharedListViewProps) {
  const { t, language } = useTranslation();
  const grouped = groupByDate(events);

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>{t('features.calendar.dayView.noEvents')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[700px]">
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => {
          const date = new Date(dateKey + 'T00:00:00');
          const isToday =
            date.toDateString() === new Date().toDateString();

          return (
            <div key={dateKey}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                {isToday && (
                  <span className="ml-2 text-primary">
                    ({t('features.calendar.today')})
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                {dayEvents.map(event => {
                  const baseEventId = getBaseEventId(event.id);

                  if (event.isMeeting) {
                    return (
                      <MeetupTimelineCard
                        key={event.id}
                        meetup={toMeetupEvent(event)}
                        href={`/meet/${baseEventId}`}
                      />
                    );
                  }

                  return <EventTimelineCard key={event.id} event={toTimelineEvent(event)} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
