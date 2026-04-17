import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

export function useVotingPasswordActions() {
  const zero = useZero()
  const { t } = useTranslation()

  const setVotingPassword = useCallback(
    (password: string) => {
      const result = zero.mutate(mutators.votingPassword.setVotingPassword({ password }))
      toast.success(t('common.votingPassword.setSuccess'))
      onServerError(result, () => toast.error(t('common.votingPassword.setFailed')))
    },
    [zero, t]
  )

  const verifyVotingPassword = useCallback(
    (password: string) => {
      const result = zero.mutate(mutators.votingPassword.verifyVotingPassword({ password }))
      onServerError(result, (message) => toast.error(message || t('common.votingPassword.verifyFailed', 'Incorrect password')))
    },
    [zero, t]
  )

  return { setVotingPassword, verifyVotingPassword }
}
