import type { Transaction } from '@rocicorp/zero';
import { zql, type Schema } from '../schema';
import { finalizeInternalChangeRequestsForEventPhaseTransition } from '../change-requests/internal-voting';
import { normalizeEditingMode } from './editing-mode-policy';

export type EventEditingMode = 'suggest_event' | 'event_final_closing_vote';

export async function transitionProcessBranchToEventMode({
  tx,
  ctx,
  amendmentId,
  processBranchId,
  editingMode,
  branch: providedBranch,
  now = Date.now(),
}: {
  tx: Transaction<Schema>;
  ctx: { readonly userID: string };
  amendmentId: string;
  processBranchId: string;
  editingMode: EventEditingMode;
  branch?: {
    id: string;
    editing_mode?: string | null;
  } | null;
  now?: number;
}) {
  const branch =
    providedBranch ??
    (await tx.run(zql.amendment_process_branch.where('id', processBranchId).one()));
  if (!branch) {
    return { changed: false, finalizedInternalChangeRequests: false };
  }
  if (branch.editing_mode === 'passed' || branch.editing_mode === 'rejected') {
    return { changed: false, finalizedInternalChangeRequests: false };
  }

  const previousMode = normalizeEditingMode(branch.editing_mode);
  if (previousMode === editingMode) {
    return { changed: false, finalizedInternalChangeRequests: false };
  }

  const shouldFinalizeInternalChangeRequests = previousMode === 'vote_internal';
  if (shouldFinalizeInternalChangeRequests) {
    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx,
      ctx,
      amendmentId,
      processBranchId: branch.id,
      now,
    });
  }

  await tx.mutate.amendment_process_branch.update({
    id: branch.id,
    editing_mode: editingMode,
    updated_at: now,
  });

  return {
    changed: true,
    finalizedInternalChangeRequests: shouldFinalizeInternalChangeRequests,
  };
}
