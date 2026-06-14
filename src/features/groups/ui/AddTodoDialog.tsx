'use client';

import { useAddTodoDialogController } from '@/features/groups/hooks/useAddTodoDialogController';
import { AddTodoDialogView } from './AddTodoDialogView';

interface AddTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
  }) => void;
}

export function AddTodoDialog({ open, onOpenChange, onSubmit }: AddTodoDialogProps) {
  return (
    <AddTodoDialogView
      open={open}
      onOpenChange={onOpenChange}
      {...useAddTodoDialogController({ onSubmit })}
    />
  );
}
