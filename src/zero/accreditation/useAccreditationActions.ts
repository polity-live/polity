import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

export function useAccreditationActions() {
  const zero = useZero()
  const { t } = useTranslation()

  const confirmAccreditation = useCallback(
    (args: { event_id: string; agenda_item_id: string; password: string }) => {
      const result = zero.mutate(mutators.accreditation.confirmAccreditation(args))
      toast.success(t('common.accreditation.confirmed'))
      onServerError(result, () => toast.error(t('common.accreditation.confirmFailed')))
    },
    [zero, t]
  )

  const deleteAccreditation = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.accreditation.deleteAccreditation({ id }))
      onServerError(result, () => toast.error(t('common.accreditation.deleteFailed')))
    },
    [zero, t]
  )

  return { confirmAccreditation, deleteAccreditation }
}
