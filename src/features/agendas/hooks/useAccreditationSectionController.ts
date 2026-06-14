import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAccreditationState } from '@/zero/accreditation/useAccreditationState';
import { useAccreditationActions } from '@/zero/accreditation/useAccreditationActions';

interface UseAccreditationSectionControllerArgs {
  eventId: string;
  agendaItemId: string;
}

export function useAccreditationSectionController({
  eventId,
  agendaItemId,
}: UseAccreditationSectionControllerArgs) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const { accreditationsByAgendaItem, isAccredited, accreditedCount, isLoading } =
    useAccreditationState({ eventId, agendaItemId, userId });

  const { confirmAccreditation } = useAccreditationActions();

  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleConfirmClick = () => {
    setShowPasswordInput(true);
    setPasswordError(null);
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!userId) return;
    setIsConfirming(true);
    setPasswordError(null);
    try {
      await confirmAccreditation({
        event_id: eventId,
        agenda_item_id: agendaItemId,
        password,
      });
      setShowPasswordInput(false);
    } catch {
      setPasswordError(t('common.accreditation.wrongPassword'));
    } finally {
      setIsConfirming(false);
    }
  };

  return {
    accreditationsByAgendaItem,
    isAccredited,
    accreditedCount,
    isLoading,
    showPasswordInput,
    isConfirming,
    passwordError,
    handleConfirmClick,
    handlePasswordSubmit,
  };
}

export type AccreditationSectionController = ReturnType<typeof useAccreditationSectionController>;
