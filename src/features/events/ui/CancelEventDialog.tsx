'use client';

/**
 * CancelEventDialog Component
 *
 * Dialog for cancelling an event with options to reassign agenda items
 * to another event.
 */

interface CancelEventDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
}
import { useCancelEventDialogController } from './useCancelEventDialogController';
import { CancelEventDialogView } from './CancelEventDialogView';

export function CancelEventDialog({
  eventId,
  open,
  onOpenChange,
  groupId,
}: CancelEventDialogProps) {
  const viewProps = useCancelEventDialogController({ eventId, open, onOpenChange, groupId });

  return <CancelEventDialogView {...viewProps} />;
}
