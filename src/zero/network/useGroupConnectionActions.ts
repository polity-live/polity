import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import {
  trackCreationUnlessSilent,
  type CreationMutationOptions,
} from '@/features/notifications/utils/mutation-finalization';

export function useGroupConnectionActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const createGroupConnection = useCallback(
    (
      args: Parameters<typeof mutators.network.createGroupConnection>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.network.createGroupConnection(args));
      trackCreationUnlessSilent(result, 'groupConnection', options, args.id);
      return result;
    },
    [zero, t]
  );

  const updateGroupConnection = useCallback(
    (args: Parameters<typeof mutators.network.updateGroupConnection>[0]) => {
      const result = zero.mutate(mutators.network.updateGroupConnection(args));
      toast.success(t('common.network.relationshipsUpdated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const deleteGroupConnection = useCallback(
    (args: Parameters<typeof mutators.network.deleteGroupConnection>[0]) => {
      const result = zero.mutate(mutators.network.deleteGroupConnection(args));
      toast.success(t('common.network.relationshipsDeleted'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const proposeGroupConnectionChange = useCallback(
    (args: Parameters<typeof mutators.network.proposeGroupConnectionChange>[0]) => {
      const result = zero.mutate(mutators.network.proposeGroupConnectionChange(args));
      toast.success(t('common.network.relationshipsUpdated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const approveGroupConnectionRequest = useCallback(
    (args: Parameters<typeof mutators.network.approveGroupConnectionRequest>[0]) => {
      const result = zero.mutate(mutators.network.approveGroupConnectionRequest(args));
      toast.success(t('common.network.relationshipsUpdated'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  const rejectGroupConnectionRequest = useCallback(
    (args: Parameters<typeof mutators.network.rejectGroupConnectionRequest>[0]) => {
      const result = zero.mutate(mutators.network.rejectGroupConnectionRequest(args));
      toast.success(t('common.network.relationshipsDeleted'));
      onServerError(result, () => toast.error(t('common.network.relationshipSaveError')));
      return result;
    },
    [zero, t]
  );

  return {
    createGroupConnection,
    updateGroupConnection,
    deleteGroupConnection,
    proposeGroupConnectionChange,
    approveGroupConnectionRequest,
    rejectGroupConnectionRequest,
  };
}
