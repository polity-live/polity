import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAccreditationState } from '@/zero/accreditation/useAccreditationState';
import { useAccreditationActions } from '@/zero/accreditation/useAccreditationActions';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { showVotingPasswordErrorToast } from '@/features/notifications/utils/voting-password-error-toast';

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

  const {
    accreditationsByAgendaItem,
    isAccredited,
    accreditationStatus,
    accreditedCount,
    isLoading,
  } = useAccreditationState({ eventId, agendaItemId, userId });

  const { can } = usePermissions({ eventId });
  const canManageAccreditations = can('manage_participants', 'events');
  const { requestAccreditation, approveAccreditation, rejectAccreditation, revokeAccreditation } =
    useAccreditationActions();

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
      await requestAccreditation({
        event_id: eventId,
        agenda_item_id: agendaItemId,
        password,
      });
      setShowPasswordInput(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('common.accreditation.wrongPassword');
      setPasswordError(message);
      showVotingPasswordErrorToast(message, userId);
    } finally {
      setIsConfirming(false);
    }
  };

  return {
    accreditationsByAgendaItem,
    isAccredited,
    accreditationStatus,
    accreditedCount,
    isLoading,
    canManageAccreditations,
    showPasswordInput,
    isConfirming,
    passwordError,
    noVotingPasswordSettingsHref: userId ? `/user/${userId}/settings?tab=passwords` : undefined,
    handleConfirmClick,
    handlePasswordSubmit,
    approveAccreditation,
    rejectAccreditation,
    revokeAccreditation,
  };
}

export type AccreditationSectionController = ReturnType<typeof useAccreditationSectionController>;
