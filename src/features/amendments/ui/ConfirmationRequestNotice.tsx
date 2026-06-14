'use client';

import { useConfirmationRequestNoticeController } from '@/features/amendments/hooks/useConfirmationRequestNoticeController';
import { ConfirmationRequestNoticeView } from './ConfirmationRequestNoticeView';

interface ConfirmationRequestNoticeProps {
  userId: string;
  onConfirm?: (confirmationId: string) => void;
  onDecline?: (confirmationId: string) => void;
  onViewChanges?: (confirmationId: string, amendmentId: string) => void;
}

export function ConfirmationRequestNotice({
  userId,
  onConfirm,
  onDecline,
  onViewChanges,
}: ConfirmationRequestNoticeProps) {
  return (
    <ConfirmationRequestNoticeView
      onViewChanges={onViewChanges}
      {...useConfirmationRequestNoticeController({ userId, onConfirm, onDecline })}
    />
  );
}
