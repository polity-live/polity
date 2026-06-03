import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

export function useNetworkLinkActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const createNetworkLink = useCallback(
    (args: Parameters<typeof mutators.network.createNetworkLink>[0]) => {
      const result = zero.mutate(mutators.network.createNetworkLink(args));
      toast.success(t('common.network.relationshipsCreated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const updateNetworkLink = useCallback(
    (args: Parameters<typeof mutators.network.updateNetworkLink>[0]) => {
      const result = zero.mutate(mutators.network.updateNetworkLink(args));
      toast.success(t('common.network.relationshipsUpdated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const deleteNetworkLink = useCallback(
    (args: Parameters<typeof mutators.network.deleteNetworkLink>[0]) => {
      const result = zero.mutate(mutators.network.deleteNetworkLink(args));
      toast.success(t('common.network.relationshipsDeleted', 'Relationships deleted'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const proposeNetworkLinkChange = useCallback(
    (args: Parameters<typeof mutators.network.proposeNetworkLinkChange>[0]) => {
      const result = zero.mutate(mutators.network.proposeNetworkLinkChange(args));
      toast.success(t('common.network.relationshipsUpdated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const approveNetworkLinkChangeRequest = useCallback(
    (args: Parameters<typeof mutators.network.approveNetworkLinkChangeRequest>[0]) => {
      const result = zero.mutate(mutators.network.approveNetworkLinkChangeRequest(args));
      toast.success(t('common.network.relationshipsUpdated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const rejectNetworkLinkChangeRequest = useCallback(
    (args: Parameters<typeof mutators.network.rejectNetworkLinkChangeRequest>[0]) => {
      const result = zero.mutate(mutators.network.rejectNetworkLinkChangeRequest(args));
      toast.success(t('common.network.relationshipsDeleted', 'Relationships deleted'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  return {
    createNetworkLink,
    updateNetworkLink,
    deleteNetworkLink,
    proposeNetworkLinkChange,
    approveNetworkLinkChangeRequest,
    rejectNetworkLinkChangeRequest,
  };
}
