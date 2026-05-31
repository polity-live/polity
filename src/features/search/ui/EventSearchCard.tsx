import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import type { EventByIdFullRow } from '@/zero/events/queries';

interface EventSearchCardProps {
  event: EventByIdFullRow;
  className?: string;
}

export function EventSearchCard({ event, className }: EventSearchCardProps) {
  const startDate = event.start_date ? new Date(event.start_date) : new Date();
  const creatorName = event.creator
    ? `${event.creator.first_name ?? ''} ${event.creator.last_name ?? ''}`.trim() ||
      event.creator.email ||
      undefined
    : undefined;

  return (
    <EventTimelineCard
      className={className}
      event={{
        id: String(event.id),
        title: event.title ?? '',
        description: typeof event.description === 'string' ? event.description : undefined,
        startDate,
        endDate: event.end_date ? new Date(event.end_date) : undefined,
        location: event.location_name ?? undefined,
        city: event.city ?? undefined,
        postcode: event.postcode ?? undefined,
        attendeeCount: event.participants?.length ?? 0,
        organizerName: creatorName,
        organizerId: event.creator?.id ?? undefined,
        groupName: event.group?.name ?? undefined,
        groupId: event.group?.id ?? undefined,
        electionsCount: event.agenda_items?.filter(item => Boolean(item.election)).length ?? 0,
        amendmentsCount: event.agenda_items?.filter(item => Boolean(item.amendment)).length ?? 0,
        hashtags: extractHashtags(event.event_hashtags),
        isSubscribed: false,
      }}
    />
  );
}
