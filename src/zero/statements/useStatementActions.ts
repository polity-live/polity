import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

/**
 * Action hook for statement mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useStatementActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createStatement = useCallback(
    (args: Parameters<typeof mutators.statements.create>[0]) => {
      const result = zero.mutate(mutators.statements.create(args));
      toast.success(t('features.statements.toasts.created'));
      onServerError(result, () => toast.error(t('features.statements.toasts.createFailed')));
      return result;
    },
    [zero]
  );

  const updateStatement = useCallback(
    (args: Parameters<typeof mutators.statements.update>[0]) => {
      const result = zero.mutate(mutators.statements.update(args));
      onServerError(result, () => toast.error(t('features.statements.toasts.updateFailed')));
    },
    [zero]
  );

  const deleteStatement = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.statements.delete({ id }));
      toast.success(t('features.statements.toasts.deleted'));
      onServerError(result, () => toast.error(t('features.statements.toasts.deleteFailed')));
    },
    [zero]
  );

  // ── Support Votes ──────────────────────────────────────────────────
  const createSupportVote = useCallback(
    (args: Parameters<typeof mutators.statements.createSupportVote>[0]) => {
      const result = zero.mutate(mutators.statements.createSupportVote(args));
      onServerError(result, () => toast.error(t('features.statements.toasts.voteFailed')));
    },
    [zero]
  );

  const updateSupportVote = useCallback(
    (args: Parameters<typeof mutators.statements.updateSupportVote>[0]) => {
      const result = zero.mutate(mutators.statements.updateSupportVote(args));
      onServerError(result, () => toast.error(t('features.statements.toasts.voteFailed')));
    },
    [zero]
  );

  const deleteSupportVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.statements.deleteSupportVote({ id }));
      onServerError(result, () => toast.error(t('features.statements.toasts.voteFailed')));
    },
    [zero]
  );

  // ── Surveys ────────────────────────────────────────────────────────
  const createSurvey = useCallback(
    (args: Parameters<typeof mutators.statements.createSurvey>[0]) => {
      const result = zero.mutate(mutators.statements.createSurvey(args));
      toast.success(t('features.statements.toasts.surveyCreated'));
      onServerError(result, () => toast.error(t('features.statements.toasts.surveyCreateFailed')));
    },
    [zero]
  );

  const deleteSurvey = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.statements.deleteSurvey({ id }));
      toast.success(t('features.statements.toasts.surveyDeleted'));
      onServerError(result, () => toast.error(t('features.statements.toasts.surveyDeleteFailed')));
    },
    [zero]
  );

  const createSurveyOption = useCallback(
    (args: Parameters<typeof mutators.statements.createSurveyOption>[0]) => {
      const result = zero.mutate(mutators.statements.createSurveyOption(args));
      onServerError(result, msg => console.error('Failed to create survey option:', msg));
    },
    [zero]
  );

  const deleteSurveyOption = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.statements.deleteSurveyOption({ id }));
      onServerError(result, msg => console.error('Failed to delete survey option:', msg));
    },
    [zero]
  );

  const createSurveyVote = useCallback(
    (args: Parameters<typeof mutators.statements.createSurveyVote>[0]) => {
      const result = zero.mutate(mutators.statements.createSurveyVote(args));
      toast.success(t('features.statements.toasts.surveyVoteCast'));
      onServerError(result, () => toast.error(t('features.statements.toasts.surveyVoteFailed')));
    },
    [zero]
  );

  const deleteSurveyVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.statements.deleteSurveyVote({ id }));
      onServerError(result, msg => console.error('Failed to remove survey vote:', msg));
    },
    [zero]
  );

  // ── Silent Operations ──────────────────────────────────────────────

  /** Update statement without toast — for auto-save scenarios */
  const updateStatementSilent = useCallback(
    (args: Parameters<typeof mutators.statements.update>[0]) => {
      const result = zero.mutate(mutators.statements.update(args));
      onServerError(result, msg => console.error('Silent statement update failed:', msg));
    },
    [zero]
  );

  return {
    // CRUD
    createStatement,
    updateStatement,
    deleteStatement,

    // Support Votes
    createSupportVote,
    updateSupportVote,
    deleteSupportVote,

    // Surveys
    createSurvey,
    deleteSurvey,
    createSurveyOption,
    deleteSurveyOption,
    createSurveyVote,
    deleteSurveyVote,

    // Silent
    updateStatementSilent,
  };
}
