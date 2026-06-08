'use client';

import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { useEventState, type EventByGroupRow } from '@/zero/events/useEventState';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface GroupEventsListProps {
  groupId: string;
  groupName?: string;
  onEventClick?: (eventId: string, eventData: EventByGroupRow) => void;
}

export function GroupEventsList({ groupId, groupName, onEventClick }: GroupEventsListProps) {
  const { t } = useTranslation();
  // Fetch group events via facade
  const { eventsByGroup, isLoading: eventsLoading } = useEventState({ groupId });

  const events = eventsByGroup;

  // Deduplicate events by ID (in case of query issues)
  const uniqueEvents = Array.from(new Map(events.map(event => [event.id, event])).values());

  // Filter for future events only and sort by date
  const futureEvents = uniqueEvents
    .filter(event => {
      if (!event.start_date) return false;
      const eventDate = new Date(event.start_date);
      return eventDate > new Date();
    })
    .sort((a, b) => {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
      const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
      return dateA - dateB;
    });

  if (eventsLoading) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        {t('common.labels.loadingEvents')}
      </div>
    );
  }

  if (futureEvents.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        {t('common.labels.noUpcomingEvents')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {futureEvents.map(event => (
        <EventSearchCard
          key={event.id}
          event={event}
          groupName={groupName}
          groupId={groupId}
          onSelect={onEventClick ? () => onEventClick(event.id, event) : undefined}
        />
      ))}
    </div>
  );
}
