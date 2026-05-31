import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

/**
 * Action hook for event mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useEventActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createEvent = useCallback(
    (args: Parameters<typeof mutators.events.create>[0]) => {
      const result = zero.mutate(mutators.events.create(args));
      toast.success(t('features.events.toasts.created'));
      onServerError(result, () => toast.error(t('features.events.toasts.createFailed')));
      return result;
    },
    [zero]
  );

  const updateEvent = useCallback(
    (args: Parameters<typeof mutators.events.update>[0]) => {
      const result = zero.mutate(mutators.events.update(args));
      onServerError(result, () => toast.error(t('features.events.toasts.updateFailed')));
    },
    [zero]
  );

  const cancelEvent = useCallback(
    (args: Parameters<typeof mutators.events.cancel>[0]) => {
      const result = zero.mutate(mutators.events.cancel(args));
      toast.success(t('features.events.toasts.cancelled'));
      onServerError(result, () => toast.error(t('features.events.toasts.cancelFailed')));
    },
    [zero]
  );

  const createOfflineParticipant = useCallback(
    (args: Parameters<typeof mutators.events.createOfflineParticipant>[0]) => {
      const result = zero.mutate(mutators.events.createOfflineParticipant(args));
      toast.success('Offline participant added');
      onServerError(result, () => toast.error('Failed to add offline participant'));
      return result;
    },
    [zero]
  );

  const updateOfflineParticipant = useCallback(
    (args: Parameters<typeof mutators.events.updateOfflineParticipant>[0]) => {
      const result = zero.mutate(mutators.events.updateOfflineParticipant(args));
      onServerError(result, () => toast.error('Failed to update offline participant'));
      return result;
    },
    [zero]
  );

  const deleteOfflineParticipant = useCallback(
    (args: Parameters<typeof mutators.events.deleteOfflineParticipant>[0]) => {
      const result = zero.mutate(mutators.events.deleteOfflineParticipant(args));
      toast.success('Offline participant removed');
      onServerError(result, () => toast.error('Failed to remove offline participant'));
      return result;
    },
    [zero]
  );

  const importOfflineParticipants = useCallback(
    (args: Parameters<typeof mutators.events.importOfflineParticipants>[0]) => {
      const result = zero.mutate(mutators.events.importOfflineParticipants(args));
      toast.success('Offline participants imported');
      onServerError(result, () => toast.error('Failed to import offline participants'));
      return result;
    },
    [zero]
  );

  // ── Participation ──────────────────────────────────────────────────
  const joinEvent = useCallback(
    (args: Parameters<typeof mutators.events.joinEvent>[0]) => {
      const result = zero.mutate(mutators.events.joinEvent(args));
      toast.success(t('features.events.toasts.joined'));
      onServerError(result, () => toast.error(t('features.events.toasts.joinFailed')));
    },
    [zero]
  );

  const inviteParticipant = useCallback(
    (args: Parameters<typeof mutators.events.inviteParticipant>[0]) => {
      const result = zero.mutate(mutators.events.inviteParticipant(args));
      toast.success(t('features.events.toasts.participantInvited'));
      onServerError(result, () => toast.error(t('features.events.toasts.inviteFailed')));
    },
    [zero]
  );

  const leaveEvent = useCallback(
    (args: Parameters<typeof mutators.events.leaveEvent>[0]) => {
      const result = zero.mutate(mutators.events.leaveEvent(args));
      toast.success(t('features.events.toasts.left'));
      onServerError(result, () => toast.error(t('features.events.toasts.leaveFailed')));
    },
    [zero]
  );

  const updateParticipant = useCallback(
    (args: Parameters<typeof mutators.events.updateParticipant>[0]) => {
      const result = zero.mutate(mutators.events.updateParticipant(args));
      onServerError(result, () => toast.error(t('features.events.toasts.updateParticipantFailed')));
    },
    [zero]
  );

  const addParticipantRole = useCallback(
    (args: Parameters<typeof mutators.events.addParticipantRole>[0]) => {
      const result = zero.mutate(mutators.events.addParticipantRole(args));
      onServerError(result, () => toast.error(t('features.events.toasts.updateParticipantFailed')));
    },
    [zero]
  );

  const removeParticipantRole = useCallback(
    (args: Parameters<typeof mutators.events.removeParticipantRole>[0]) => {
      const result = zero.mutate(mutators.events.removeParticipantRole(args));
      onServerError(result, () => toast.error(t('features.events.toasts.updateParticipantFailed')));
    },
    [zero]
  );

  const syncParticipantRoles = useCallback(
    (args: Parameters<typeof mutators.events.syncParticipantRoles>[0]) => {
      const result = zero.mutate(mutators.events.syncParticipantRoles(args));
      onServerError(result, () => toast.error(t('features.events.toasts.updateParticipantFailed')));
    },
    [zero]
  );

  // ── Delegates ──────────────────────────────────────────────────────
  const finalizeDelegates = useCallback(
    (args: Parameters<typeof mutators.events.finalizeDelegates>[0]) => {
      const result = zero.mutate(mutators.events.finalizeDelegates(args));
      toast.success(t('features.events.toasts.delegatesFinalized'));
      onServerError(result, () => toast.error(t('features.events.toasts.delegatesFinalizeFailed')));
    },
    [zero]
  );

  // ── Roles ──────────────────────────────────────────────────────────
  const createRole = useCallback(
    (args: Parameters<typeof mutators.events.createRole>[0]) => {
      const result = zero.mutate(mutators.events.createRole(args));
      toast.success(t('features.events.toasts.roleCreated'));
      onServerError(result, () => toast.error(t('features.events.toasts.roleCreateFailed')));
    },
    [zero]
  );

  const updateRole = useCallback(
    (args: Parameters<typeof mutators.events.updateRole>[0]) => {
      const result = zero.mutate(mutators.events.updateRole(args));
      onServerError(result, () => toast.error(t('features.events.toasts.roleUpdateFailed')));
    },
    [zero]
  );

  const deleteRole = useCallback(
    (args: Parameters<typeof mutators.events.deleteRole>[0]) => {
      const result = zero.mutate(mutators.events.deleteRole(args));
      toast.success(t('features.events.toasts.roleDeleted'));
      onServerError(result, () => toast.error(t('features.events.toasts.roleDeleteFailed')));
    },
    [zero]
  );

  // ── Event Exceptions ───────────────────────────────────────────────
  const createException = useCallback(
    (args: Parameters<typeof mutators.events.createException>[0]) => {
      const result = zero.mutate(mutators.events.createException(args));
      toast.success(t('features.events.toasts.exceptionCreated'));
      onServerError(result, () => toast.error(t('features.events.toasts.exceptionCreateFailed')));
    },
    [zero]
  );

  const updateException = useCallback(
    (args: Parameters<typeof mutators.events.updateException>[0]) => {
      const result = zero.mutate(mutators.events.updateException(args));
      toast.success(t('features.events.toasts.exceptionUpdated'));
      onServerError(result, () => toast.error(t('features.events.toasts.exceptionUpdateFailed')));
    },
    [zero]
  );

  const deleteException = useCallback(
    (args: Parameters<typeof mutators.events.deleteException>[0]) => {
      const result = zero.mutate(mutators.events.deleteException(args));
      toast.success(t('features.events.toasts.exceptionDeleted'));
      onServerError(result, () => toast.error(t('features.events.toasts.exceptionDeleteFailed')));
    },
    [zero]
  );

  return {
    // CRUD
    createEvent,
    updateEvent,
    cancelEvent,
    createOfflineParticipant,
    updateOfflineParticipant,
    deleteOfflineParticipant,
    importOfflineParticipants,

    // Participation
    joinEvent,
    inviteParticipant,
    leaveEvent,
    updateParticipant,
    addParticipantRole,
    removeParticipantRole,
    syncParticipantRoles,

    // Delegates
    finalizeDelegates,

    // Roles
    createRole,
    updateRole,
    deleteRole,

    // Exceptions
    createException,
    updateException,
    deleteException,
  };
}
