import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

/**
 * Action hook for document mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useDocumentActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createDocument = useCallback(
    (args: Parameters<typeof mutators.documents.create>[0]) => {
      const result = zero.mutate(mutators.documents.create(args));
      toast.success(t('features.documents.toasts.created'));
      onServerError(result, () => toast.error(t('features.documents.toasts.createFailed')));
      return result;
    },
    [zero]
  );

  const updateDocument = useCallback(
    (args: Parameters<typeof mutators.documents.updateContent>[0]) => {
      const result = zero.mutate(mutators.documents.updateContent(args));
      onServerError(result, () => toast.error(t('features.documents.toasts.updateFailed')));
      return result;
    },
    [zero]
  );

  const updateGroupDocumentTitle = useCallback(
    (args: Parameters<typeof mutators.documents.updateGroupDocumentTitle>[0]) => {
      const result = zero.mutate(mutators.documents.updateGroupDocumentTitle(args));
      onServerError(result, () => toast.error(t('features.documents.toasts.updateFailed')));
      return result;
    },
    [zero]
  );

  const deleteDocument = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.documents.delete({ id }));
      toast.success(t('features.documents.toasts.deleted'));
      onServerError(result, () => toast.error(t('features.documents.toasts.deleteFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Versions ───────────────────────────────────────────────────────
  const createVersion = useCallback(
    (args: Parameters<typeof mutators.documents.createVersion>[0]) => {
      const result = zero.mutate(mutators.documents.createVersion(args));
      toast.success(t('features.documents.toasts.versionCreated'));
      onServerError(result, () => toast.error(t('features.documents.toasts.versionCreateFailed')));
      return result;
    },
    [zero]
  );

  const updateVersion = useCallback(
    (args: Parameters<typeof mutators.documents.updateVersion>[0]) => {
      const result = zero.mutate(mutators.documents.updateVersion(args));
      onServerError(result, () => toast.error(t('features.documents.toasts.versionUpdateFailed')));
      return result;
    },
    [zero]
  );

  const deleteVersion = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.documents.deleteVersion({ id }));
      toast.success(t('features.documents.toasts.versionDeleted'));
      onServerError(result, () => toast.error(t('features.documents.toasts.versionDeleteFailed')));
      return result;
    },
    [zero]
  );

  // ── Threads ────────────────────────────────────────────────────────
  const createThread = useCallback(
    (args: Parameters<typeof mutators.documents.createThread>[0]) => {
      const result = zero.mutate(mutators.documents.createThread(args));
      toast.success(t('features.documents.toasts.threadCreated'));
      onServerError(result, () => toast.error(t('features.documents.toasts.threadCreateFailed')));
      return result;
    },
    [zero, t]
  );

  const voteThread = useCallback(
    (args: Parameters<typeof mutators.documents.voteThread>[0]) => {
      const result = zero.mutate(mutators.documents.voteThread(args));
      onServerError(result, () => toast.error(t('features.documents.toasts.voteThreadFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Comments ───────────────────────────────────────────────────────
  const addComment = useCallback(
    (args: Parameters<typeof mutators.documents.addComment>[0]) => {
      const result = zero.mutate(mutators.documents.addComment(args));
      toast.success(t('features.documents.toasts.commentAdded'));
      onServerError(result, () => toast.error(t('features.documents.toasts.commentAddFailed')));
      return result;
    },
    [zero, t]
  );

  const voteComment = useCallback(
    (args: Parameters<typeof mutators.documents.voteComment>[0]) => {
      const result = zero.mutate(mutators.documents.voteComment(args));
      onServerError(result, () => toast.error(t('features.documents.toasts.voteCommentFailed')));
      return result;
    },
    [zero, t]
  );

  const updateCommentVote = useCallback(
    (args: Parameters<typeof mutators.documents.updateCommentVote>[0]) => {
      const result = zero.mutate(mutators.documents.updateCommentVote(args));
      onServerError(result, () =>
        toast.error(t('features.documents.toasts.updateCommentVoteFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const deleteCommentVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.documents.deleteCommentVote({ id }));
      onServerError(result, () =>
        toast.error(t('features.documents.toasts.deleteCommentVoteFailed'))
      );
      return result;
    },
    [zero, t]
  );

  // ── Collaboration ──────────────────────────────────────────────────
  const addCollaborator = useCallback(
    (args: Parameters<typeof mutators.documents.addCollaborator>[0]) => {
      const result = zero.mutate(mutators.documents.addCollaborator(args));
      toast.success(t('features.documents.toasts.collaboratorAdded'));
      onServerError(result, () =>
        toast.error(t('features.documents.toasts.collaboratorAddFailed'))
      );
      return result;
    },
    [zero]
  );

  // ── Thread vote management ─────────────────────────────────────────
  const updateThreadVote = useCallback(
    (args: Parameters<typeof mutators.documents.updateThreadVote>[0]) => {
      const result = zero.mutate(mutators.documents.updateThreadVote(args));
      onServerError(result, () => toast.error(t('features.documents.toasts.voteThreadFailed')));
      return result;
    },
    [zero, t]
  );

  const deleteThreadVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.documents.deleteThreadVote({ id }));
      onServerError(result, () => toast.error(t('features.documents.toasts.voteThreadFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Thread/Comment count updates ───────────────────────────────────
  const updateThread = useCallback(
    (args: Parameters<typeof mutators.documents.updateThread>[0]) => {
      const result = zero.mutate(mutators.documents.updateThread(args));
      onServerError(result, msg => console.error('Failed to update thread:', msg));
      return result;
    },
    [zero]
  );

  const updateComment = useCallback(
    (args: Parameters<typeof mutators.documents.updateComment>[0]) => {
      const result = zero.mutate(mutators.documents.updateComment(args));
      onServerError(result, msg => console.error('Failed to update comment:', msg));
      return result;
    },
    [zero]
  );

  return {
    // CRUD
    createDocument,
    updateDocument,
    updateGroupDocumentTitle,
    deleteDocument,

    // Versions
    createVersion,
    updateVersion,
    deleteVersion,

    // Threads
    createThread,
    voteThread,
    updateThreadVote,
    deleteThreadVote,
    updateThread,

    // Comments
    addComment,
    voteComment,
    updateCommentVote,
    deleteCommentVote,
    updateComment,

    // Collaboration
    addCollaborator,
  };
}
