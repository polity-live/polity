import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for user mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useUserActions() {
  const zero = useZero()
  const { t } = useTranslation()

  const updateProfile = useCallback(
    (args: Parameters<typeof mutators.users.updateProfile>[0]) => {
      const result = zero.mutate(mutators.users.updateProfile(args))
      toast.success(t('features.user.toasts.profileUpdated'))
      onServerError(result, () => toast.error(t('features.user.toasts.profileUpdateFailed')))
    },
    [zero]
  )

  const follow = useCallback(
    (args: Parameters<typeof mutators.users.follow>[0]) => {
      const result = zero.mutate(mutators.users.follow(args))
      toast.success(t('features.user.toasts.followed'))
      onServerError(result, () => toast.error(t('features.user.toasts.followFailed')))
    },
    [zero]
  )

  const unfollow = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.users.unfollow({ id }))
      toast.success(t('features.user.toasts.unfollowed'))
      onServerError(result, () => toast.error(t('features.user.toasts.unfollowFailed')))
    },
    [zero]
  )

  return {
    updateProfile,
    follow,
    unfollow,
  }
}
