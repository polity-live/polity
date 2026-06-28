/**
 * useCancelEvent Hook
 *
 * Manages event cancellation with optional reassignment of agenda items
 * to a different event.
 */

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useEventForCancel } from '@/zero/events/useEventState';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AgendaItem {
  id: string;
  title: string;
  order_index: number;
  amendment?: {
    id: string;
    title: string;
  };
  election?: {
    id: string;
    role?: {
      id: string;
      name: string;
    };
  };
}

interface UseCancelEventResult {
  isLoading: boolean;
  agendaItems: AgendaItem[];
  cancelEvent: (params: CancelEventParams) => Promise<void>;
  scheduleRevote: (
    roleId: string,
    revoteDate: Date,
    groupId: string,
    groupName: string,
    roleTitle: string
  ) => Promise<void>;
}

interface CancelEventParams {
  eventId: string;
  reason: string;
  reassignToEventId?: string;
  itemsToReassign?: string[];
}

export function useCancelEvent(eventId: string): UseCancelEventResult {
  const { user } = useAuth();
  const { cancelEvent: doCancelEvent } = useEventActions();
  const { updateAgendaItem } = useAgendaActions();
  const { updateRole } = useGroupActions();
  const [isLoading, setIsLoading] = useState(false);

  // Query event data with agenda items
  const { event } = useEventForCancel(eventId);
  const agendaItems = useMemo((): AgendaItem[] => {
    if (!event?.agenda_items) return [];
    return event.agenda_items
      .map(item => ({
        id: item.id,
        title: item.title || '',
        order_index: item.order_index || 0,
        amendment: item.amendment
          ? { id: item.amendment.id, title: item.amendment.title || '' }
          : undefined,
        election: item.election[0]
          ? {
              id: item.election[0].id,
              role: item.election[0].role
                ? { id: item.election[0].role.id, name: item.election[0].role.name || '' }
                : undefined,
            }
          : undefined,
      }))
      .sort((a, b) => a.order_index - b.order_index);
  }, [event?.agenda_items]);

  const cancelEvent = useCallback(
    async (params: CancelEventParams) => {
      if (!user) {
        toast.error(translateText('generated.inline.0159_you_must_be_logged_in_702ab856'));
        return;
      }

      setIsLoading(true);
      try {
        // Update event status to cancelled
        await waitForClientApply(
          doCancelEvent({
            id: params.eventId,
            cancel_reason: params.reason,
          })
        );

        // Reassign agenda items if specified
        if (params.reassignToEventId && params.itemsToReassign?.length) {
          // Reassign items sequentially
          let newSortOrder = 1;
          for (const itemId of params.itemsToReassign) {
            await waitForClientApply(
              updateAgendaItem({
                id: itemId,
                event_id: params.reassignToEventId,
                order_index: newSortOrder++,
              })
            );
          }
        }

        toast.success(translateText('generated.inline.0448_event_cancelled_successfully_aa9fc6b1'));
      } catch (error) {
        console.error('Error cancelling event:', error);
        toast.error(translateText('generated.inline.0449_failed_to_cancel_event_d08bac7e'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, event]
  );

  const scheduleRevote = useCallback(
    async (roleId: string, revoteDate: Date) => {
      if (!user) {
        toast.error(translateText('generated.inline.0159_you_must_be_logged_in_702ab856'));
        return;
      }

      setIsLoading(true);
      try {
        await waitForClientApply(
          updateRole({
            id: roleId,
            scheduled_revote_date: revoteDate.getTime(),
          })
        );

        toast.success(translateText('generated.inline.0450_revote_scheduled_16d14bd2'));
      } catch (error) {
        console.error('Error scheduling revote:', error);
        toast.error(translateText('generated.inline.0451_failed_to_schedule_revote_dbc40039'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  return {
    isLoading,
    agendaItems,
    cancelEvent,
    scheduleRevote,
  };
}
