import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { EventByGroupRow } from '@/zero/events/useEventState';

interface UseGroupEventsListControllerOptions {
  groupId: string;
}

export function useGroupEventsListController({ groupId }: UseGroupEventsListControllerOptions) {
  const { t } = useTranslation();
  void groupId;

  return {
    eventsLoading: false,
    futureEvents: [] as EventByGroupRow[],
    labels: {
      loadingEvents: t('common.labels.loadingEvents'),
      noUpcomingEvents: t('common.labels.noUpcomingEvents'),
    },
  };
}

export type { EventByGroupRow };
