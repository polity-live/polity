import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import type { TodoUpdateInput } from './schema';
import {
  trackCreationUnlessSilent,
  type CreationMutationOptions,
} from '@/features/notifications/utils/mutation-finalization';

/**
 * Action hook for todo mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useTodoActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createTodo = useCallback(
    (args: Parameters<typeof mutators.todos.create>[0], options?: CreationMutationOptions) => {
      const result = zero.mutate(mutators.todos.create(args));
      trackCreationUnlessSilent(result, 'todo', options, args.id);
      return result;
    },
    [zero, t]
  );

  const createFullTodo = useCallback(
    (args: Parameters<typeof mutators.todos.createFull>[0], options?: CreationMutationOptions) => {
      const result = zero.mutate(mutators.todos.createFull(args));
      trackCreationUnlessSilent(result, 'todo', options, args.todo.id);
      return result;
    },
    [zero, t]
  );

  const updateTodo = useCallback(
    (args: TodoUpdateInput) => {
      const result = zero.mutate(mutators.todos.update(args));
      onServerError(result, () => toast.error(t('features.todos.toasts.updateFailed')));
      return result;
    },
    [zero, t]
  );

  const deleteTodo = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.delete({ id }));
      toast.success(t('features.todos.toasts.deleted'));
      onServerError(result, () => toast.error(t('features.todos.toasts.deleteFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Toggle Complete ────────────────────────────────────────────────
  const toggleComplete = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.toggleComplete({ id }));
      onServerError(result, () => toast.error(t('features.todos.toasts.toggleFailed')));
      return result;
    },
    [zero, t]
  );

  const archiveTodo = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.archive({ id }));
      toast.success(t('features.todos.toasts.archived'));
      onServerError(result, () => toast.error(t('features.todos.toasts.archiveFailed')));
      return result;
    },
    [zero, t]
  );

  const unarchiveTodo = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.unarchive({ id }));
      toast.success(t('features.todos.toasts.unarchived'));
      onServerError(result, () => toast.error(t('features.todos.toasts.unarchiveFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Assignments ────────────────────────────────────────────────────
  const assignUser = useCallback(
    (args: Parameters<typeof mutators.todos.assign>[0]) => {
      const result = zero.mutate(mutators.todos.assign(args));
      toast.success(t('features.todos.toasts.userAssigned'));
      onServerError(result, () => toast.error(t('features.todos.toasts.assignFailed')));
      return result;
    },
    [zero, t]
  );

  const unassignUser = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.todos.unassign({ id }));
      toast.success(t('features.todos.toasts.userUnassigned'));
      onServerError(result, () => toast.error(t('features.todos.toasts.unassignFailed')));
      return result;
    },
    [zero, t]
  );

  return {
    createTodo,
    createFullTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    archiveTodo,
    unarchiveTodo,
    assignUser,
    unassignUser,
  };
}
