import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for todo mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useTodoActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── CRUD ───────────────────────────────────────────────────────────
  const createTodo = useCallback(
    (args: Parameters<typeof mutators.todos.create>[0]) => {
      const result = zero.mutate(mutators.todos.create(args))
      toast.success(t('features.todos.toasts.created'))
      onServerError(result, () => toast.error(t('features.todos.toasts.createFailed', 'Failed to create todo')))
    },
    [zero]
  )

  const updateTodo = useCallback(
    (args: Parameters<typeof mutators.todos.update>[0]) => {
      const result = zero.mutate(mutators.todos.update(args))
      onServerError(result, () => toast.error(t('features.todos.toasts.updateFailed')))
    },
    [zero]
  )

  const deleteTodo = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.delete({ id }))
      toast.success(t('features.todos.toasts.deleted'))
      onServerError(result, () => toast.error(t('features.todos.toasts.deleteFailed')))
    },
    [zero]
  )

  // ── Toggle Complete ────────────────────────────────────────────────
  const toggleComplete = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.toggleComplete({ id }))
      onServerError(result, () => toast.error(t('features.todos.toasts.toggleFailed')))
    },
    [zero]
  )

  // ── Assignments ────────────────────────────────────────────────────
  const assignUser = useCallback(
    (args: Parameters<typeof mutators.todos.assign>[0]) => {
      const result = zero.mutate(mutators.todos.assign(args))
      toast.success(t('features.todos.toasts.userAssigned'))
      onServerError(result, () => toast.error(t('features.todos.toasts.assignFailed')))
    },
    [zero]
  )

  const unassignUser = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.unassign({ id }))
      toast.success(t('features.todos.toasts.userUnassigned'))
      onServerError(result, () => toast.error(t('features.todos.toasts.unassignFailed')))
    },
    [zero]
  )

  return {
    createTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    assignUser,
    unassignUser,
  }
}
