'use client';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    label: string;
    type: string;
    amount: number;
    direction: 'income' | 'expense';
    payerUserId?: string;
    payerGroupId?: string;
    receiverUserId?: string;
    receiverGroupId?: string;
  }) => void;
  direction: 'income' | 'expense';
  groupId: string;
}
import { useAddPaymentDialogController } from './useAddPaymentDialogController';
import { AddPaymentDialogView } from './AddPaymentDialogView';

export function AddPaymentDialog({
  open,
  onOpenChange,
  onSubmit,
  direction,
  groupId,
}: AddPaymentDialogProps) {
  const viewProps = useAddPaymentDialogController({
    open,
    onOpenChange,
    onSubmit,
    direction,
    groupId,
  });

  return <AddPaymentDialogView {...viewProps} />;
}
