import { useMemo } from 'react';
import { withCalculatedAgendaTimes } from '@/zero/agendas/agenda-times';
import { useAgendaItemsByEvent } from '@/zero/events/useEventState';

export function useAgendaItems(eventId: string) {
  const { agendaItems: agendaItemsWithRelations, isLoading: isRelationsLoading } =
    useAgendaItemsByEvent(eventId);
  // The authorized full projection already includes event start dates and all
  // timing fields. Calculate from that same live snapshot rather than waiting
  // for a second, overlapping relation tree before displaying the agenda.
  const agendaItems = useMemo(
    () => withCalculatedAgendaTimes(agendaItemsWithRelations),
    [agendaItemsWithRelations]
  );

  return {
    agendaItems,
    isLoading: isRelationsLoading,
    error: undefined,
  };
}
