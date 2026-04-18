import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for workflow mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useWorkflowActions() {
  const zero = useZero()
  const { t } = useTranslation()

  const createWorkflow = useCallback(
    (args: Parameters<typeof mutators.network.createWorkflow>[0]) => {
      const result = zero.mutate(mutators.network.createWorkflow(args))
      toast.success(t('features.network.toasts.workflowCreated', 'Workflow created'))
      onServerError(result, () => toast.error(t('features.network.toasts.workflowCreateFailed', 'Failed to create workflow')))
    },
    [zero, t]
  )

  const updateWorkflow = useCallback(
    (args: Parameters<typeof mutators.network.updateWorkflow>[0]) => {
      const result = zero.mutate(mutators.network.updateWorkflow(args))
      onServerError(result, () => toast.error(t('features.network.toasts.workflowUpdateFailed', 'Failed to update workflow')))
    },
    [zero, t]
  )

  const deleteWorkflow = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.network.deleteWorkflow({ id }))
      toast.success(t('features.network.toasts.workflowDeleted', 'Workflow deleted'))
      onServerError(result, () => toast.error(t('features.network.toasts.workflowDeleteFailed', 'Failed to delete workflow')))
    },
    [zero, t]
  )

  const createWorkflowStep = useCallback(
    (args: Parameters<typeof mutators.network.createWorkflowStep>[0]) => {
      const result = zero.mutate(mutators.network.createWorkflowStep(args))
      onServerError(result, () => toast.error(t('features.network.toasts.stepCreateFailed', 'Failed to add step')))
    },
    [zero, t]
  )

  const updateWorkflowStep = useCallback(
    (args: Parameters<typeof mutators.network.updateWorkflowStep>[0]) => {
      const result = zero.mutate(mutators.network.updateWorkflowStep(args))
      onServerError(result, () => toast.error(t('features.network.toasts.stepUpdateFailed', 'Failed to update step')))
    },
    [zero, t]
  )

  const deleteWorkflowStep = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.network.deleteWorkflowStep({ id }))
      onServerError(result, () => toast.error(t('features.network.toasts.stepDeleteFailed', 'Failed to remove step')))
    },
    [zero, t]
  )

  return {
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    createWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
  }
}
