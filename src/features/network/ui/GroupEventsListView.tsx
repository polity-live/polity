import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import type { EventByGroupRow } from '../hooks/useGroupEventsListController';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { useCallback, useMemo } from 'react';

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
  eventsLoading: _eventsLoading,
  futureEvents: _futureEvents,
  labels,
  onEventClick,
}: GroupEventsListViewProps) {
  void _eventsLoading;
  void _futureEvents;
  const now = useMemo(() => Date.now(), [groupId]);
  const context = useMemo(
    () => ({
      groupId,
      from: now,
      to: null,
      query: '',
      order: 'ascending' as const,
      creatorId: undefined,
    }),
    [groupId, now]
  );

  return (
    <PolityZeroListView<EventByGroupRow, { id: string; start_date?: number }, typeof context>
      context={context}
      historyKey={`network-group-${groupId}-events`}
      getPageQuery={useCallback(
        ({ limit, start, dir, settled }) => ({
          query: queries.events.calendarPage({ ...context, limit, start, dir }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        }),
        [context]
      )}
      getSingleQuery={useCallback(
        ({ id, settled }) => ({
          query: queries.events.byId({ id }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        }),
        []
      )}
      getRowKey={event => event.id}
      toStartRow={event => ({ id: event.id, start_date: event.start_date ?? undefined })}
      estimateSize={220}
      className="max-h-[40rem] min-h-64 overflow-auto"
      renderRow={event => (
        <EventSearchCard
          event={event}
          groupName={groupName}
          groupId={groupId}
          onSelect={onEventClick ? () => onEventClick(event.id, event) : undefined}
        />
      )}
      renderSkeleton={() => (
        <SectionSkeleton rows={1} density="compact" label={labels.loadingEvents} />
      )}
      renderEmpty={() => (
        <div className="text-muted-foreground py-4 text-center text-sm">
          {labels.noUpcomingEvents}
        </div>
      )}
    />
  );
}
