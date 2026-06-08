import { useCallback } from 'react';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import type { EnrichedPathSegment } from '@/features/amendments/logic/amendmentPathHelpers';

interface CreateAmendmentPathArgs {
  amendmentId: string;
  amendmentTitle: string;
  amendmentReason: string | null;
  enrichedPath: EnrichedPathSegment[];
  sourceGroupId?: string | null;
  workflowId?: string | null;
  pathMode?: 'hierarchy' | 'workflow';
  evaluationMode?: 'none' | 'fixed_date' | 'relative_to_vote';
  evaluationDate?: number | null;
  evaluationOffsetMonths?: number | null;
  evaluationOffsetYears?: number | null;
}

/**
 * Orchestration hook that persists an amendment path with its
 * agenda items, votes, and path segments.
 *
 * Used by both the create flow (useCreateAmendmentForm) and the
 * process flow (AmendmentProcessFlow) to ensure identical path creation.
 */
export function useCreateAmendmentPath() {
  const { initializeProcessPath } = useAmendmentActions();

  const createAmendmentPath = useCallback(
    async ({
      amendmentId,
      amendmentTitle,
      amendmentReason,
      enrichedPath,
      sourceGroupId,
      workflowId,
      pathMode = 'hierarchy',
      evaluationMode = 'none',
      evaluationDate = null,
      evaluationOffsetMonths = null,
      evaluationOffsetYears = null,
    }: CreateAmendmentPathArgs) => {
      if (enrichedPath.length === 0) {
        return null;
      }

      return initializeProcessPath({
        amendment_id: amendmentId,
        amendment_title: amendmentTitle,
        amendment_reason: amendmentReason,
        enriched_path: enrichedPath,
        source_group_id: sourceGroupId ?? null,
        workflow_id: workflowId ?? null,
        path_mode: pathMode,
        evaluation_mode: evaluationMode,
        evaluation_date: evaluationDate,
        evaluation_offset_months: evaluationOffsetMonths,
        evaluation_offset_years: evaluationOffsetYears,
      });
    },
    [initializeProcessPath]
  );

  return { createAmendmentPath };
}
