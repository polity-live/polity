'use client';

/**
 * CancelEventDialog Component
 *
 * Dialog for cancelling an event with options to reassign agenda items
 * to another event.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useCancelEvent } from '../hooks/useCancelEvent';
import { useEventsByGroup } from '@/zero/events/useEventState';

interface CancelEventDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
}
export function useCancelEventDialogController({
  eventId,
  open,
  onOpenChange,
  groupId,
}: CancelEventDialogProps) {
  const { t } = useTranslation();
  const { isLoading, agendaItems, cancelEvent } = useCancelEvent(eventId);

  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [targetEventId, setTargetEventId] = useState<string>('');

  // Query other events in the group for reassignment
  const { events: availableEvents } = useEventsByGroup(groupId, eventId);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setReason('');
      setSelectedItems([]);
      setTargetEventId('');
    }
  }, [open]);

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === agendaItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(agendaItems.map(item => item.id));
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      return;
    }

    await cancelEvent({
      eventId,
      reason: reason.trim(),
      reassignToEventId: targetEventId || undefined,
      itemsToReassign: selectedItems.length > 0 ? selectedItems : undefined,
    });

    onOpenChange(false);
  };
  return {
    eventId,
    open,
    onOpenChange,
    groupId,
    t,
    isLoading,
    agendaItems,
    cancelEvent,
    reason,
    setReason,
    selectedItems,
    setSelectedItems,
    targetEventId,
    setTargetEventId,
    availableEvents,
    handleItemToggle,
    handleSelectAll,
    handleCancel,
  };
}
