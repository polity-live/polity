import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getEditingModeOption } from '@/features/shared/ui/status';
import { mutators } from '../mutators';
import { onServerError, serverConfirmed } from '../mutate-with-server-check';

/**
 * Action hook for amendment mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useAmendmentActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createAmendment = useCallback(
    (args: Parameters<typeof mutators.amendments.create>[0]) => {
      const result = zero.mutate(mutators.amendments.create(args));
      toast.success(t('features.amendments.toasts.created'));
      onServerError(result, () => toast.error(t('features.amendments.toasts.createFailed')));
      return result;
    },
    [zero]
  );

  const updateAmendment = useCallback(
    (args: Parameters<typeof mutators.amendments.update>[0]) => {
      const result = zero.mutate(mutators.amendments.update(args));
      onServerError(result, () => toast.error(t('features.amendments.toasts.updateFailed')));
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteAmendment = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.delete({ id }));
      toast.success(t('features.amendments.toasts.deleted'));
      onServerError(result, () => toast.error(t('features.amendments.toasts.deleteFailed')));
    },
    [zero]
  );

  // ── Collaboration ──────────────────────────────────────────────────
  const requestCollaboration = useCallback(
    (args: Parameters<typeof mutators.amendments.addCollaborator>[0]) => {
      const result = zero.mutate(mutators.amendments.addCollaborator(args));
      toast.success(t('features.amendments.toasts.collaborationRequested'));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.collaborationRequestFailed'))
      );
    },
    [zero]
  );

  const leaveCollaboration = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.removeCollaborator({ id }));
      toast.success(t('features.amendments.toasts.leftCollaboration'));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.leaveCollaborationFailed'))
      );
    },
    [zero]
  );

  const acceptInvitation = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.updateCollaborator({ id, status: 'member' }));
      toast.success(t('features.amendments.toasts.joinedCollaboration'));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.joinCollaborationFailed'))
      );
    },
    [zero]
  );

  const updateCollaborator = useCallback(
    (args: Parameters<typeof mutators.amendments.updateCollaborator>[0]) => {
      const result = zero.mutate(mutators.amendments.updateCollaborator(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.updateCollaboratorFailed'))
      );
    },
    [zero]
  );

  const createStreetDesign = useCallback(
    (args: Parameters<typeof mutators.amendments.createStreetDesign>[0]) => {
      const result = zero.mutate(mutators.amendments.createStreetDesign(args));
      onServerError(result, () => toast.error(t('features.amendments.toasts.updateFailed')));
      return serverConfirmed(result);
    },
    [zero]
  );

  const updateStreetDesign = useCallback(
    (args: Parameters<typeof mutators.amendments.updateStreetDesign>[0]) => {
      const result = zero.mutate(mutators.amendments.updateStreetDesign(args));
      onServerError(result, () => toast.error(t('features.amendments.toasts.updateFailed')));
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteStreetDesign = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteStreetDesign({ id }));
      onServerError(result, () => toast.error(t('features.amendments.toasts.deleteFailed')));
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Workflow ────────────────────────────────────────────────────────
  const updateEditingMode = useCallback(
    (id: string, editingMode: string) => {
      const result = zero.mutate(mutators.amendments.update({ id, editing_mode: editingMode }));
      const modeLabel = getEditingModeOption(editingMode, t).label;
      toast.success(t('features.amendments.toasts.workflowChanged', { status: modeLabel }));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.workflowChangeFailed'))
      );
    },
    [zero]
  );

  const submitToEvent = useCallback(
    (id: string, eventId: string) => {
      const result = zero.mutate(
        mutators.amendments.update({
          id,
          editing_mode: 'suggest_event',
          event_id: eventId,
        })
      );
      toast.success(t('features.amendments.toasts.submittedToEvent'));
      onServerError(result, () => toast.error(t('features.amendments.toasts.submitToEventFailed')));
    },
    [zero]
  );

  const finalizeAmendment = useCallback(
    (id: string, finalResult: 'passed' | 'rejected') => {
      const mutationResult = zero.mutate(
        mutators.amendments.update({
          id,
          editing_mode: finalResult,
        })
      );
      toast.success(
        finalResult === 'passed'
          ? t('features.amendments.toasts.passed')
          : t('features.amendments.toasts.rejected')
      );
      onServerError(mutationResult, () =>
        toast.error(t('features.amendments.toasts.finalizeFailed'))
      );
    },
    [zero]
  );

  // ── Change Requests ────────────────────────────────────────────────
  const createChangeRequest = useCallback(
    (args: Parameters<typeof mutators.amendments.createChangeRequest>[0]) => {
      const result = zero.mutate(mutators.amendments.createChangeRequest(args));
      toast.success(t('features.amendments.toasts.changeRequestCreated'));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.changeRequestCreateFailed'))
      );
    },
    [zero]
  );

  const updateChangeRequest = useCallback(
    (args: Parameters<typeof mutators.amendments.updateChangeRequest>[0]) => {
      const result = zero.mutate(mutators.amendments.updateChangeRequest(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.changeRequestUpdateFailed'))
      );
    },
    [zero]
  );

  const voteOnChangeRequest = useCallback(
    (args: Parameters<typeof mutators.amendments.voteOnChangeRequest>[0]) => {
      const result = zero.mutate(mutators.amendments.voteOnChangeRequest(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.voteOnChangeRequestFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const finalizeInternalChangeRequestVote = useCallback(
    (args: Parameters<typeof mutators.amendments.finalizeInternalChangeRequestVote>[0]) => {
      const result = zero.mutate(mutators.amendments.finalizeInternalChangeRequestVote(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.changeRequestUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const finalizeExpiredInternalChangeRequestVotes = useCallback(
    (args: Parameters<typeof mutators.amendments.finalizeExpiredInternalChangeRequestVotes>[0]) => {
      const result = zero.mutate(
        mutators.amendments.finalizeExpiredInternalChangeRequestVotes(args)
      );
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.changeRequestUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const repairInternalChangeRequestResolution = useCallback(
    (args: Parameters<typeof mutators.amendments.repairInternalChangeRequestResolution>[0]) => {
      const result = zero.mutate(mutators.amendments.repairInternalChangeRequestResolution(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.changeRequestUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Support ────────────────────────────────────────────────────────
  const supportAmendment = useCallback(
    (args: Parameters<typeof mutators.amendments.supportAmendment>[0]) => {
      const result = zero.mutate(mutators.amendments.supportAmendment(args));
      onServerError(result, () => toast.error(t('features.amendments.toasts.supportAddFailed')));
    },
    [zero]
  );

  const updateSupportVote = useCallback(
    (args: Parameters<typeof mutators.amendments.updateSupportVote>[0]) => {
      const result = zero.mutate(mutators.amendments.updateSupportVote(args));
      onServerError(result, () => toast.error(t('common.voteToasts.voteUpdateFailed')));
    },
    [zero]
  );

  const deleteSupportVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteSupportVote({ id }));
      onServerError(result, () => toast.error(t('common.voteToasts.voteDeleteFailed')));
    },
    [zero]
  );

  const createSupportConfirmation = useCallback(
    (args: Parameters<typeof mutators.amendments.createSupportConfirmation>[0]) => {
      const result = zero.mutate(mutators.amendments.createSupportConfirmation(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.supportConfirmationFailed'))
      );
    },
    [zero]
  );

  const updateSupportConfirmation = useCallback(
    (args: Parameters<typeof mutators.amendments.updateSupportConfirmation>[0]) => {
      const result = zero.mutate(mutators.amendments.updateSupportConfirmation(args));
      const status = args.status;
      if (status === 'confirmed' || status === 'declined') {
        toast.success(
          status === 'confirmed'
            ? t('features.amendments.toasts.supportConfirmed')
            : t('features.amendments.toasts.supportDeclined')
        );
      }
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.supportConfirmationUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const upsertGroupDecision = useCallback(
    (args: Parameters<typeof mutators.amendments.upsertGroupDecision>[0]) => {
      const result = zero.mutate(mutators.amendments.upsertGroupDecision(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.supportConfirmationUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const initializeProcessPath = useCallback(
    (args: Parameters<typeof mutators.amendments.initializeProcessPath>[0]) => {
      const result = zero.mutate(mutators.amendments.initializeProcessPath(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processRunCreateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const resolveProcessVote = useCallback(
    (args: Parameters<typeof mutators.amendments.resolveProcessVote>[0]) => {
      const result = zero.mutate(mutators.amendments.resolveProcessVote(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processStepUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const completeProcessTaskWithEvent = useCallback(
    (args: Parameters<typeof mutators.amendments.completeProcessTaskWithEvent>[0]) => {
      const result = zero.mutate(mutators.amendments.completeProcessTaskWithEvent(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processTaskUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Subscription (delegates to common mutators) ────────────────────
  const subscribe = useCallback(
    (args: { id: string; amendment_id: string }) => {
      const result = zero.mutate(
        mutators.common.subscribe({
          id: args.id,
          amendment_id: args.amendment_id,
          user_id: null,
          group_id: null,
          event_id: null,
          blog_id: null,
        })
      );
      toast.success(t('features.amendments.toasts.subscribed'));
      onServerError(result, () => toast.error(t('features.amendments.toasts.subscribeFailed')));
    },
    [zero]
  );

  const unsubscribe = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.common.unsubscribe({ id }));
      toast.success(t('features.amendments.toasts.unsubscribed'));
      onServerError(result, () => toast.error(t('features.amendments.toasts.unsubscribeFailed')));
    },
    [zero]
  );

  // ── Amendment Paths ────────────────────────────────────────────────
  const createPath = useCallback(
    (args: Parameters<typeof mutators.amendments.createPath>[0]) => {
      const result = zero.mutate(mutators.amendments.createPath(args));
      onServerError(result, () => toast.error(t('features.amendments.toasts.pathCreateFailed')));
      return serverConfirmed(result);
    },
    [zero]
  );

  const deletePath = useCallback(
    (args: Parameters<typeof mutators.amendments.deletePath>[0]) => {
      const result = zero.mutate(mutators.amendments.deletePath(args));
      onServerError(result, () => toast.error(t('features.amendments.toasts.pathDeleteFailed')));
      return serverConfirmed(result);
    },
    [zero]
  );

  const createPathSegment = useCallback(
    (args: Parameters<typeof mutators.amendments.createPathSegment>[0]) => {
      const result = zero.mutate(mutators.amendments.createPathSegment(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.pathSegmentCreateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const deletePathSegment = useCallback(
    (args: Parameters<typeof mutators.amendments.deletePathSegment>[0]) => {
      const result = zero.mutate(mutators.amendments.deletePathSegment(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.pathSegmentDeleteFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const createProcessRun = useCallback(
    (args: Parameters<typeof mutators.amendments.createProcessRun>[0]) => {
      const result = zero.mutate(mutators.amendments.createProcessRun(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processRunCreateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const updateProcessRun = useCallback(
    (args: Parameters<typeof mutators.amendments.updateProcessRun>[0]) => {
      const result = zero.mutate(mutators.amendments.updateProcessRun(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processRunUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteProcessRun = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteProcessRun({ id }));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processRunDeleteFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const createProcessBranch = useCallback(
    (args: Parameters<typeof mutators.amendments.createProcessBranch>[0]) => {
      const result = zero.mutate(mutators.amendments.createProcessBranch(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processBranchCreateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const updateProcessBranch = useCallback(
    (args: Parameters<typeof mutators.amendments.updateProcessBranch>[0]) => {
      const result = zero.mutate(mutators.amendments.updateProcessBranch(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processBranchUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteProcessBranch = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteProcessBranch({ id }));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processBranchDeleteFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const createProcessStepRun = useCallback(
    (args: Parameters<typeof mutators.amendments.createProcessStepRun>[0]) => {
      const result = zero.mutate(mutators.amendments.createProcessStepRun(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processStepCreateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const updateProcessStepRun = useCallback(
    (args: Parameters<typeof mutators.amendments.updateProcessStepRun>[0]) => {
      const result = zero.mutate(mutators.amendments.updateProcessStepRun(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processStepUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteProcessStepRun = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteProcessStepRun({ id }));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processStepDeleteFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const createProcessTask = useCallback(
    (args: Parameters<typeof mutators.amendments.createProcessTask>[0]) => {
      const result = zero.mutate(mutators.amendments.createProcessTask(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processTaskCreateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const updateProcessTask = useCallback(
    (args: Parameters<typeof mutators.amendments.updateProcessTask>[0]) => {
      const result = zero.mutate(mutators.amendments.updateProcessTask(args));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processTaskUpdateFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteProcessTask = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteProcessTask({ id }));
      onServerError(result, () =>
        toast.error(t('features.amendments.toasts.processTaskDeleteFailed'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  return {
    // CRUD
    createAmendment,
    updateAmendment,
    deleteAmendment,

    // Collaboration
    requestCollaboration,
    leaveCollaboration,
    acceptInvitation,
    updateCollaborator,
    createStreetDesign,
    updateStreetDesign,
    deleteStreetDesign,

    // Workflow
    updateEditingMode,
    submitToEvent,
    finalizeAmendment,

    // Paths
    createPath,
    deletePath,
    createPathSegment,
    deletePathSegment,
    createProcessRun,
    updateProcessRun,
    deleteProcessRun,
    createProcessBranch,
    updateProcessBranch,
    deleteProcessBranch,
    createProcessStepRun,
    updateProcessStepRun,
    deleteProcessStepRun,
    createProcessTask,
    updateProcessTask,
    deleteProcessTask,

    // Change requests
    createChangeRequest,
    updateChangeRequest,
    voteOnChangeRequest,
    finalizeInternalChangeRequestVote,
    finalizeExpiredInternalChangeRequestVotes,
    repairInternalChangeRequestResolution,

    // Support
    supportAmendment,
    updateSupportVote,
    deleteSupportVote,
    createSupportConfirmation,
    updateSupportConfirmation,
    upsertGroupDecision,
    initializeProcessPath,
    resolveProcessVote,
    completeProcessTaskWithEvent,

    // Subscription
    subscribe,
    unsubscribe,
  };
}
