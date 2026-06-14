'use client';

import type { ReactNode } from 'react';

import { useTransferAgendaItemDialogController } from '../hooks/useTransferAgendaItemDialogController';
import { TransferAgendaItemDialogView } from './TransferAgendaItemDialogView';

interface TransferAgendaItemDialogProps {
  agendaItemId: string;
  agendaItemTitle: string;
  currentEventId: string;
  currentEventTitle: string;
  onTransferComplete?: () => void;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransferAgendaItemDialog({
  agendaItemId,
  agendaItemTitle,
  currentEventId,
  currentEventTitle,
  onTransferComplete,
  trigger,
  open,
  onOpenChange,
}: TransferAgendaItemDialogProps) {
  const controller = useTransferAgendaItemDialogController({
    agendaItemId,
    agendaItemTitle,
    currentEventId,
    currentEventTitle,
    onTransferComplete,
    open,
    onOpenChange,
  });

  return (
    <TransferAgendaItemDialogView
      agendaItemTitle={agendaItemTitle}
      currentEventTitle={currentEventTitle}
      trigger={trigger}
      controller={controller}
    />
  );
}
