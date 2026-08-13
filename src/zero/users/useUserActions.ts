import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError, serverConfirmed, waitForClientApply } from '../mutate-with-server-check';

/**
 * Action hook for user mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useUserActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const updateProfile = useCallback(
    (args: Parameters<typeof mutators.users.updateProfile>[0]) => {
      const result = zero.mutate(mutators.users.updateProfile(args));
      toast.success(t('features.user.toasts.profileUpdated'));
      onServerError(result, () => toast.error(t('features.user.toasts.profileUpdateFailed')));
      return result;
    },
    [zero, t]
  );

  const updateProfileClientApplied = useCallback(
    async (args: Parameters<typeof mutators.users.updateProfile>[0]) => {
      const result = zero.mutate(mutators.users.updateProfile(args));
      toast.success(t('features.user.toasts.profileUpdated'));
      onServerError(result, () => toast.error(t('features.user.toasts.profileUpdateFailed')));
      await waitForClientApply(result);
      return result;
    },
    [zero, t]
  );

  const updateProfileServerConfirmed = useCallback(
    async (args: Parameters<typeof mutators.users.updateProfile>[0]) => {
      const result = zero.mutate(mutators.users.updateProfile(args));
      onServerError(result, () => toast.error(t('features.user.toasts.profileUpdateFailed')));
      await serverConfirmed(result);
      toast.success(t('features.user.toasts.profileUpdated'));
      return result;
    },
    [zero, t]
  );

  const follow = useCallback(
    (args: Parameters<typeof mutators.users.follow>[0]) => {
      const result = zero.mutate(mutators.users.follow(args));
      toast.success(t('features.user.toasts.followed'));
      onServerError(result, () => toast.error(t('features.user.toasts.followFailed')));
      return result;
    },
    [zero, t]
  );

  const unfollow = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.users.unfollow({ id }));
      toast.success(t('features.user.toasts.unfollowed'));
      onServerError(result, () => toast.error(t('features.user.toasts.unfollowFailed')));
      return result;
    },
    [zero, t]
  );

  return {
    updateProfile,
    updateProfileClientApplied,
    updateProfileServerConfirmed,
    follow,
    unfollow,
  };
}
