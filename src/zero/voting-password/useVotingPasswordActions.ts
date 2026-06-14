import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { serverConfirmed } from '../mutate-with-server-check';

export function useVotingPasswordActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const setVotingPassword = useCallback(
    async (password: string) => {
      const result = zero.mutate(mutators.votingPassword.setVotingPassword({ password }));
      try {
        await serverConfirmed(result);
        toast.success(t('common.votingPassword.setSuccess'));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('common.votingPassword.setFailed');
        toast.error(message || t('common.votingPassword.setFailed'));
        throw error;
      }
    },
    [zero, t]
  );

  const verifyVotingPassword = useCallback(
    async (password: string) => {
      const result = zero.mutate(mutators.votingPassword.verifyVotingPassword({ password }));
      try {
        await serverConfirmed(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('common.votingPassword.verifyFailed');
        toast.error(message || t('common.votingPassword.verifyFailed'));
        throw error;
      }
    },
    [zero, t]
  );

  return { setVotingPassword, verifyVotingPassword };
}
