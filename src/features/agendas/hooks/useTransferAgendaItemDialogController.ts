import { useMemo, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useUserEventParticipations } from '@/zero/events/useEventState';
import { useAgendaItemMutations } from './useAgendaItemMutations';

export interface EventWithAgendaPermission {
  id: string;
  title: string;
  start_date?: number | null;
  location_name?: string | null;
  group?: { name: string | null };
}

interface UseTransferAgendaItemDialogControllerArgs {
  agendaItemId: string;
  agendaItemTitle: string;
  currentEventId: string;
  currentEventTitle: string;
  onTransferComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useTransferAgendaItemDialogController({
  agendaItemId,
  agendaItemTitle,
  currentEventId,
  currentEventTitle,
  onTransferComplete,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: UseTransferAgendaItemDialogControllerArgs) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const { handleTransfer, transferLoading } = useAgendaItemMutations(agendaItemId, currentEventId);
  const { participations: participationsData, isLoading: participationsLoading } =
    useUserEventParticipations(user?.id);

  const eventsWithPermission = useMemo(() => {
    if (!participationsData) return [];

    const events: EventWithAgendaPermission[] = [];

    participationsData.forEach(participation => {
      if (participation.event?.id === currentEventId) return;
      if (!participation.event) return;

      events.push({
        id: participation.event.id,
        title: participation.event.title || t('features.events.editPage.untitled'),
        start_date: participation.event.start_date,
        location_name: participation.event.location_name,
        group: participation.event.group,
      });
    });

    return events.filter((event, index, self) => self.findIndex(e => e.id === event.id) === index);
  }, [participationsData, currentEventId, t]);

  const selectedEvent = eventsWithPermission.find(e => e.id === selectedEventId);

  const handleConfirmTransfer = async () => {
    if (!selectedEvent) return;

    try {
      await handleTransfer({
        targetEventId: selectedEvent.id,
        agendaItemTitle,
        sourceEventTitle: currentEventTitle,
        targetEventTitle: selectedEvent.title,
      });

      toast.success(t('features.events.agenda.transferSuccess'));
      setOpen(false);
      setSelectedEventId('');
      onTransferComplete?.();
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error(t('features.events.agenda.transferError'));
    }
  };

  return {
    open,
    setOpen,
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    eventsWithPermission,
    participationsLoading,
    transferLoading,
    handleConfirmTransfer,
  };
}

export type TransferAgendaItemDialogController = ReturnType<
  typeof useTransferAgendaItemDialogController
>;
