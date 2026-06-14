import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';

interface UseConfirmationRequestNoticeControllerProps {
  userId: string;
  onConfirm?: (confirmationId: string) => void;
  onDecline?: (confirmationId: string) => void;
}

export function useConfirmationRequestNoticeController({
  userId,
  onConfirm,
  onDecline,
}: UseConfirmationRequestNoticeControllerProps) {
  const { t } = useTranslation();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { supportConfirmations: pendingConfirmations } = useAmendmentState({
    userId,
    includeSupportConfirmations: true,
  });

  const handleConfirm = async (confirmationId: string) => {
    setProcessingId(confirmationId);
    try {
      onConfirm?.(confirmationId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (confirmationId: string) => {
    setProcessingId(confirmationId);
    try {
      onDecline?.(confirmationId);
    } finally {
      setProcessingId(null);
    }
  };

  return {
    labels: {
      title: t('features.amendments.supportConfirmation.pendingNotice.title'),
      description: t('features.amendments.supportConfirmation.pendingNotice.description'),
      untitled: t('features.amendments.common.untitled'),
      changeRequest: t('features.amendments.changeRequests.changeRequest'),
      viewChanges: t('features.amendments.supportConfirmation.actions.viewChanges'),
      confirm: t('features.amendments.supportConfirmation.actions.confirm'),
      decline: t('features.amendments.supportConfirmation.actions.decline'),
    },
    pendingConfirmations,
    processingId,
    onConfirmClick: handleConfirm,
    onDeclineClick: handleDecline,
  };
}
