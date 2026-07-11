import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { serverConfirmed } from '../mutate-with-server-check';

export function useAccreditationActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const requestAccreditation = useCallback(
    async (args: Parameters<typeof mutators.accreditation.requestAccreditation>[0]) => {
      const result = zero.mutate(mutators.accreditation.requestAccreditation(args));
      await serverConfirmed(result);
      toast.success(t('common.accreditation.confirmed'));
    },
    [zero, t]
  );

  const decide = useCallback(
    async (
      action: 'approveAccreditation' | 'rejectAccreditation' | 'revokeAccreditation',
      args: { accreditation_id: string; reason?: string }
    ) => {
      const result = zero.mutate(mutators.accreditation[action](args));
      await serverConfirmed(result);
    },
    [zero]
  );

  return {
    requestAccreditation,
    confirmAccreditation: requestAccreditation,
    approveAccreditation: (args: { accreditation_id: string; reason?: string }) =>
      decide('approveAccreditation', args),
    rejectAccreditation: (args: { accreditation_id: string; reason?: string }) =>
      decide('rejectAccreditation', args),
    revokeAccreditation: (args: { accreditation_id: string; reason?: string }) =>
      decide('revokeAccreditation', args),
  };
}
