import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import type { CalendarEvent } from '@/features/calendar/types/calendar.types';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import type { EventByIdFullRow } from '@/zero/events/queries';
import type { EventByGroupRow } from '@/zero/events/useEventState';

type EventSearchCardRow = EventByIdFullRow | EventByGroupRow | CalendarEvent;

interface EventSearchCardProps {
  event: EventSearchCardRow;
  className?: string;
  href?: string;
  onSelect?: () => void;
  groupName?: string;
  groupId?: string;
}

function getCreatorName(event: EventSearchCardRow): string | undefined {
  if ('creator' in event && event.creator) {
    return (
      `${event.creator.first_name ?? ''} ${event.creator.last_name ?? ''}`.trim() ||
      event.creator.email ||
      undefined
    );
  }

  if ('organizer' in event) {
    return event.organizer?.name ?? undefined;
  }

  return 'organizerName' in event ? event.organizerName : undefined;
}

function getCreatorId(event: EventSearchCardRow): string | undefined {
  if ('creator' in event && event.creator?.id) {
    return event.creator.id;
  }

  if ('organizer' in event && event.organizer?.id) {
    return event.organizer.id;
  }

  return 'organizerId' in event && typeof event.organizerId === 'string'
    ? event.organizerId
    : undefined;
}

function getGroupName(event: EventSearchCardRow, fallbackGroupName?: string): string | undefined {
  if (fallbackGroupName) {
    return fallbackGroupName;
  }

  if ('group' in event && event.group?.name) {
    return event.group.name;
  }

  return 'groupName' in event && typeof event.groupName === 'string' ? event.groupName : undefined;
}

function getGroupId(event: EventSearchCardRow, fallbackGroupId?: string): string | undefined {
  if (fallbackGroupId) {
    return fallbackGroupId;
  }

  if ('group' in event && event.group?.id) {
    return event.group.id;
  }

  return 'group_id' in event ? (event.group_id ?? undefined) : undefined;
}

function getAttendeeCount(event: EventSearchCardRow): number {
  if ('attendeeCount' in event && typeof event.attendeeCount === 'number') {
    return event.attendeeCount;
  }

  if ('participant_count' in event && typeof event.participant_count === 'number') {
    return event.participant_count;
  }

  if ('participants' in event && Array.isArray(event.participants)) {
    return event.participants.length;
  }

  return 0;
}

function getHashtags(event: EventSearchCardRow): { id: string; tag: string }[] {
  if ('event_hashtags' in event) {
    return extractHashtags(event.event_hashtags);
  }

  return 'hashtags' in event && Array.isArray(event.hashtags) ? [...event.hashtags] : [];
}

function getAgendaCounts(event: EventSearchCardRow): {
  electionsCount: number;
  amendmentsCount: number;
} {
  if (!('agenda_items' in event) || !Array.isArray(event.agenda_items)) {
    return { electionsCount: 0, amendmentsCount: 0 };
  }

  return {
    electionsCount: event.agenda_items.filter(item => Boolean(item.election)).length,
    amendmentsCount: event.agenda_items.filter(item => Boolean(item.amendment)).length,
  };
}

function getLocationName(event: EventSearchCardRow): string | undefined {
  if ('location_name' in event) {
    return event.location_name ?? undefined;
  }

  const location = (event as Record<string, unknown>).location;
  if (typeof location === 'string') return location;

  return undefined;
}

function getPostcode(event: EventSearchCardRow): string | undefined {
  if ('postcode' in event && typeof event.postcode === 'string') {
    return event.postcode;
  }

  if ('post_code' in event && typeof event.post_code === 'string') {
    return event.post_code;
  }

  return undefined;
}

export function EventSearchCard({
  event,
  className,
  href,
  onSelect,
  groupName,
  groupId,
}: EventSearchCardProps) {
  const startDate = event.start_date ? new Date(event.start_date) : new Date();
  const endDate = 'end_date' in event && event.end_date ? new Date(event.end_date) : undefined;
  const creatorName = getCreatorName(event);
  const creatorId = getCreatorId(event);
  const resolvedGroupName = getGroupName(event, groupName);
  const resolvedGroupId = getGroupId(event, groupId);
  const { electionsCount, amendmentsCount } = getAgendaCounts(event);

  return (
    <EventTimelineCard
      className={className}
      href={href}
      onSelect={onSelect}
      event={{
        id: String(event.id),
        title: event.title ?? '',
        description: typeof event.description === 'string' ? event.description : undefined,
        startDate,
        endDate,
        location: getLocationName(event),
        city: event.city ?? undefined,
        postcode: getPostcode(event),
        attendeeCount: getAttendeeCount(event),
        organizerName: creatorName,
        organizerId: creatorId,
        groupName: resolvedGroupName,
        groupId: resolvedGroupId,
        electionsCount,
        amendmentsCount,
        hashtags: getHashtags(event),
        isSubscribed: false,
      }}
    />
  );
}
