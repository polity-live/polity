import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEventState, type EventByGroupRow } from '@/zero/events/useEventState';

interface UseGroupEventsListControllerOptions {
  groupId: string;
}

export function useGroupEventsListController({ groupId }: UseGroupEventsListControllerOptions) {
  const { t } = useTranslation();
  const { eventsByGroup, isLoading: eventsLoading } = useEventState({ groupId });
  const uniqueEvents = Array.from(new Map(eventsByGroup.map(event => [event.id, event])).values());
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

  return {
    eventsLoading,
    futureEvents,
    labels: {
      loadingEvents: t('common.labels.loadingEvents'),
      noUpcomingEvents: t('common.labels.noUpcomingEvents'),
    },
  };
}

export type { EventByGroupRow };
