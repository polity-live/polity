/**
 * useAgendaNavigation Hook
 *
 * Provides functionality for navigating through agenda items,
 * activating/completing items, and sending notifications.
 */

import { useState, useMemo, useCallback } from 'react';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useEventActions } from '@/zero/events/useEventActions';
import { useEventWithAgendaAndParticipants } from '@/zero/events/useEventState';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { toast } from 'sonner';

interface AgendaItem {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  order: number;
  activatedAt?: number;
  completedAt?: number;
}

interface UseAgendaNavigationResult {
  currentAgendaItem: AgendaItem | null;
  startableAgendaItem: AgendaItem | null;
  currentIndex: number;
  totalItems: number;
  canNavigate: boolean;
  isLoading: boolean;
  activateAgendaItem: (itemId: string) => Promise<void>;
  startFirstPendingItem: () => Promise<void>;
  moveToNextItem: () => Promise<void>;
  moveToPreviousItem: () => Promise<void>;
  completeCurrentItem: () => Promise<void>;
  hasNextItem: boolean;
  hasPreviousItem: boolean;
  hasStartableItem: boolean;
  canMoveToNextItem: boolean;
  isCurrentItemCompleted: boolean;
}

export function useAgendaNavigation(eventId: string): UseAgendaNavigationResult {
  const { user } = useAuth();
  const { updateAgendaItem } = useAgendaActions();
  const { updateEvent } = useEventActions();
  const { can } = usePermissions({ eventId });
  const [isLoading, setIsLoading] = useState(false);

  // Query event with agenda items
  const { event, isLoading: queryLoading } = useEventWithAgendaAndParticipants(eventId);
  const agendaItems: AgendaItem[] = useMemo(() => {
    if (!event?.agenda_items) return [];
    return [...event.agenda_items]
      .map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        order: item.order_index || 0,
        activatedAt: typeof item.activated_at === 'number' ? item.activated_at : undefined,
        completedAt: typeof item.completed_at === 'number' ? item.completed_at : undefined,
      }))
      .sort((a, b) => a.order - b.order);
  }, [event?.agenda_items]);

  const currentAgendaItemId = useMemo(() => {
    if (!event?.agenda_items) return null;

    const activeItem = [...event.agenda_items].find(item => {
      const isActive = item.status === 'in-progress' || item.status === 'active';
      const isCompleted = item.status === 'completed' || Boolean(item.completed_at);
      return isActive && !isCompleted;
    });

    if (activeItem) {
      return activeItem.id;
    }

    if (event.current_agenda_item_id) {
      const currentItem = event.agenda_items.find(item => item.id === event.current_agenda_item_id);
      if (
        currentItem &&
        (currentItem.status === 'in-progress' || currentItem.status === 'active')
      ) {
        return currentItem.id;
      }
    }

    return null;
  }, [event?.agenda_items, event?.current_agenda_item_id]);

  const currentAgendaItem = useMemo(() => {
    if (!currentAgendaItemId) return null;
    return agendaItems.find(item => item.id === currentAgendaItemId) || null;
  }, [currentAgendaItemId, agendaItems]);

  const currentIndex = useMemo(() => {
    if (!currentAgendaItemId) return -1;
    return agendaItems.findIndex(item => item.id === currentAgendaItemId);
  }, [currentAgendaItemId, agendaItems]);

  const canManageAgenda = can('manage', 'agendaItems');

  const hasNextItem = currentIndex < agendaItems.length - 1;
  const hasPreviousItem = currentIndex > 0;
  const startableAgendaItem = useMemo(
    () =>
      agendaItems.find(item => !(item.status === 'completed' || Boolean(item.completedAt))) ?? null,
    [agendaItems]
  );
  const hasStartableItem = !currentAgendaItem && Boolean(startableAgendaItem);
  const isCurrentItemCompleted =
    currentAgendaItem?.status === 'completed' || Boolean(currentAgendaItem?.completedAt);
  const canMoveToNextItem = hasNextItem && isCurrentItemCompleted;

  const activateAgendaItem = useCallback(
    async (itemId: string) => {
      if (!user || !canManageAgenda) {
        toast.error('You do not have permission to manage the agenda');
        return;
      }

      const item = agendaItems.find(i => i.id === itemId);
      if (!item) {
        toast.error('Agenda item not found');
        return;
      }

      setIsLoading(true);
      try {
        // Deactivate current item if exists
        if (currentAgendaItem) {
          await updateAgendaItem({
            id: currentAgendaItem.id,
            status: currentAgendaItem.completedAt ? 'completed' : 'pending',
          });
        }

        // Activate the new item
        await updateAgendaItem({
          id: itemId,
          status: 'in-progress',
          start_time: Date.now(),
          activated_at: Date.now(),
        });
        await updateEvent({
          id: eventId,
          current_agenda_item_id: itemId,
        });

        toast.success(`Activated: ${item.title}`);
      } catch (error) {
        console.error('Error activating agenda item:', error);
        toast.error('Failed to activate agenda item');
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, canManageAgenda, eventId, event?.title, currentAgendaItem, agendaItems]
  );

  const startFirstPendingItem = useCallback(async () => {
    if (!startableAgendaItem) {
      toast.info('No remaining agenda item to start');
      return;
    }

    await activateAgendaItem(startableAgendaItem.id);
  }, [startableAgendaItem, activateAgendaItem]);

  const moveToNextItem = useCallback(async () => {
    if (!hasNextItem) {
      toast.info('No more agenda items');
      return;
    }

    if (!isCurrentItemCompleted) {
      toast.info('Complete the current agenda item first');
      return;
    }

    const nextItem = agendaItems[currentIndex + 1];
    await activateAgendaItem(nextItem.id);
  }, [hasNextItem, isCurrentItemCompleted, currentIndex, agendaItems, activateAgendaItem]);

  const moveToPreviousItem = useCallback(async () => {
    if (!hasPreviousItem) {
      toast.info('No previous agenda items');
      return;
    }

    const prevItem = agendaItems[currentIndex - 1];
    await activateAgendaItem(prevItem.id);
  }, [hasPreviousItem, currentIndex, agendaItems, activateAgendaItem]);

  const completeCurrentItem = useCallback(async () => {
    if (!user || !canManageAgenda || !currentAgendaItem) {
      toast.error('Cannot complete agenda item');
      return;
    }

    setIsLoading(true);
    try {
      // Complete current item
      await updateAgendaItem({
        id: currentAgendaItem.id,
        status: 'completed',
        start_time: currentAgendaItem.activatedAt ?? Date.now(),
        end_time: Date.now(),
        completed_at: Date.now(),
      });
      await updateEvent({
        id: eventId,
        current_agenda_item_id: null,
      });

      toast.success(`Completed: ${currentAgendaItem.title}`);
    } catch (error) {
      console.error('Error completing agenda item:', error);
      toast.error('Failed to complete agenda item');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, canManageAgenda, currentAgendaItem, eventId]);

  return {
    currentAgendaItem,
    startableAgendaItem,
    currentIndex,
    totalItems: agendaItems.length,
    canNavigate: canManageAgenda,
    isLoading: isLoading || queryLoading,
    activateAgendaItem,
    startFirstPendingItem,
    moveToNextItem,
    moveToPreviousItem,
    completeCurrentItem,
    hasNextItem,
    hasPreviousItem,
    hasStartableItem,
    canMoveToNextItem,
    isCurrentItemCompleted,
  };
}
