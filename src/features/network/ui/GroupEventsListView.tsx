import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import type { EventByGroupRow } from '../hooks/useGroupEventsListController';

interface GroupEventsListViewProps {
  groupId: string;
  groupName?: string;
  eventsLoading: boolean;
  futureEvents: EventByGroupRow[];
  labels: {
    loadingEvents: string;
    noUpcomingEvents: string;
  };
  onEventClick?: (eventId: string, eventData: EventByGroupRow) => void;
}

export function GroupEventsListView({
  groupId,
  groupName,
  eventsLoading,
  futureEvents,
  labels,
  onEventClick,
}: GroupEventsListViewProps) {
  if (eventsLoading) {
    return <SectionSkeleton rows={3} density="compact" label={labels.loadingEvents} />;
  }

  if (futureEvents.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        {labels.noUpcomingEvents}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {futureEvents.map((event: any) => (
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
