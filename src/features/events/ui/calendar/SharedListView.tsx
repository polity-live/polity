import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { getBaseEventId } from '@/features/calendar/logic/eventIdUtils';
import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import { MeetupTimelineCard } from '@/features/timeline/ui/cards/MeetupTimelineCard';
import { CalendarChronologicalListView } from '@/features/shared/ui/calendar';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import type { CSSProperties } from 'react';

interface SharedListViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onEventSelect: (event: CalendarEvent) => void;
  queryScope?: { groupId?: string; creatorId?: string; query?: string };
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

export function SharedListView({
  events,
  selectedDate,
  onEventSelect,
  queryScope,
}: SharedListViewProps) {
  const { t } = useTranslation();

  const renderCalendarEvent = (event: CalendarEvent) => {
    if (event.isMeeting) {
      return (
        <MeetupTimelineCard meetup={toMeetupEvent(event)} onSelect={() => onEventSelect(event)} />
      );
    }
    return (
      <EventTimelineCard event={toTimelineEvent(event)} onSelect={() => onEventSelect(event)} />
    );
  };

  if (queryScope) {
    const context = {
      ...queryScope,
      from: null,
      to: null,
      order: 'ascending' as const,
    };
    return (
      <PolityZeroListView<any, { start_date: number; id: string }, typeof context>
        context={context}
        historyKey={`calendar-list-${queryScope.groupId ?? queryScope.creatorId ?? 'all'}`}
        estimateSize={300}
        getRowKey={event => event.id}
        toStartRow={event => ({ start_date: event.start_date, id: event.id })}
        getPageQuery={({ limit, start, dir, settled }) => ({
          query: queries.events.calendarPage({
            ...context,
            query: queryScope.query ?? '',
            limit,
            start,
            dir,
          }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        })}
        getSingleQuery={({ id, settled }) => ({
          query: queries.events.byId({ id }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        })}
        renderRow={(row, index) => {
          const rowEvents = events
            .filter(event => getBaseEventId(event.id) === row.id)
            .sort((left, right) => left.start_date - right.start_date);
          return (
            <section className="space-y-3 pb-5" data-calendar-base-event={row.id}>
              {(rowEvents.length > 0 ? rowEvents : [row as CalendarEvent]).map(event => (
                <div key={event.id} className="space-y-2">
                  <h3 className="text-muted-foreground text-sm font-semibold">
                    {new Date(event.start_date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h3>
                  <div
                    className="civic-load-card-place"
                    style={{ '--civic-load-index': Math.min(index, 11) } as CSSProperties}
                  >
                    {renderCalendarEvent(event)}
                  </div>
                </div>
              ))}
            </section>
          );
        }}
        renderSkeleton={() => <Skeleton className="h-64 w-full rounded-xl" />}
        renderEmpty={() => (
          <p className="text-muted-foreground py-12 text-center">
            {t('features.calendar.dayView.noEvents')}
          </p>
        )}
        className="h-[700px] overflow-auto"
      />
    );
  }

  return (
    <CalendarChronologicalListView
      items={events}
      selectedDate={selectedDate}
      getItemDate={event => event.start_date}
      getItemKey={event => event.id}
      emptyText={t('features.calendar.dayView.noEvents')}
      itemMotion="place"
      renderItem={renderCalendarEvent}
    />
  );
}
