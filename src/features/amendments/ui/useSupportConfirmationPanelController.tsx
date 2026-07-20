'use client';

import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSupportConfirmation } from '../hooks/useSupportConfirmation';
import { de, enUS } from 'date-fns/locale';

interface SupportConfirmationPanelProps {
  groupId: string;
}
export function useSupportConfirmationPanelController({ groupId }: SupportConfirmationPanelProps) {
  const { t, i18n } = useTranslation();
  const { pendingConfirmations, isLoading, confirmSupport, declineSupport } =
    useSupportConfirmation(groupId);
  const [selectedConfirmation, setSelectedConfirmation] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const dateLocale = i18n.language === 'de' ? de : enUS;

  const handleConfirm = async (confirmationId: string) => {
    setProcessingId(confirmationId);
    try {
      await confirmSupport(confirmationId);
      setSelectedConfirmation(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (confirmationId: string) => {
    setProcessingId(confirmationId);
    try {
      await declineSupport(confirmationId);
      setSelectedConfirmation(null);
    } finally {
      setProcessingId(null);
    }
  };
  return {
    groupId,
    t,
    i18n,
    pendingConfirmations,
    isLoading,
    confirmSupport,
    declineSupport,
    selectedConfirmation,
    setSelectedConfirmation,
    processingId,
    setProcessingId,
    dateLocale,
    status: (isLoading ? 'loading' : pendingConfirmations.length === 0 ? 'empty' : 'ready') as
      'loading' | 'empty' | 'ready',
    handleConfirm,
    handleDecline,
  };
}
