import type { Value } from 'platejs';
import type { Transaction } from '@rocicorp/zero';
import { zql, type Schema } from '@/zero/schema';
import { CollaborationError } from '@/features/collaboration/logic/types';
import {
  isolateProposal,
  mergeProposal,
  normalized,
} from '@/features/collaboration/logic/proposals';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import { reconcileProjection } from '@/features/collaboration/logic/reconcile';
import { checksum, commitState, loadStored } from './store';
import { rows, sqlTransaction } from './transaction';
import { recordDecision } from './governance';

/** The caller has already authorized the existing business decision. Neither the
 * decision result nor submitted content is supplied by an editing client. */
export async function resolveSubmittedText(
  tx: Transaction<Schema>,
  actor: string,
  id: string,
  result: 'passed' | 'rejected' | 'tie',
  options: {
    resolutionMethod: 'direct_internal' | 'internal_vote' | null;
    resolvedInMode: string | null;
    visibilityScope: 'public' | 'collaborators';
    now: number;
  },
  retry = false
) {
  const sql = sqlTransaction(tx);
  const cr = await tx.run(zql.change_request.where('id', id).one());
  if (!cr?.suggestion_id) throw new CollaborationError('proposal_anchor_missing');
  const [proof] = await rows<{
    document_id: string;
    base: Value;
    submitted: Value;
    submitted_content: unknown;
    checksum: string;
    application_status: string;
    decision_result: string | null;
  }>(
    sql,
    `select p.*,b.projection as base,s.projection as submitted from collaboration_proposal p
    join collaboration_revision b on b.id=p.base_revision_id
    join collaboration_revision s on s.id=p.submitted_revision_id where p.change_request_id=$1 for update of p`,
    [id]
  );
  if (!proof) throw new CollaborationError('submitted_revision_missing');
  if (proof.decision_result && proof.decision_result !== result)
    throw new CollaborationError('decision_already_recorded');
  const status = result === 'passed' ? 'accepted' : 'rejected';
  if (proof.decision_result && (!retry || proof.application_status === 'applied'))
    return { changeRequest: cr, status, applicationStatus: proof.application_status };
  const doc = await loadStored(sql, proof.document_id);
  let conflict: string | undefined;
  let revisionId: string | null = null;
  try {
    const snapshot = createChangeRequestDiffSnapshot(cr.suggestion_id, proof.submitted);
    if (
      checksum(snapshot) !== proof.checksum ||
      checksum(proof.submitted_content) !== proof.checksum
    )
      throw new CollaborationError('submitted_content_changed');
    const next =
      result === 'passed'
        ? mergeProposal(
            normalized(proof.base),
            isolateProposal(proof.submitted, cr.suggestion_id, true),
            normalized(doc.projection)
          )
        : doc.projection;
    const committed = await commitState(
      sql,
      doc,
      reconcileProjection(doc.kind, doc.state, next),
      actor,
      `decision:${id}`,
      'decision'
    );
    revisionId = committed.revisionId;
  } catch (error) {
    if (
      !(error instanceof CollaborationError) ||
      ![
        'proposal_content_conflict',
        'proposal_order_conflict',
        'proposal_deleted_target_conflict',
        'submitted_content_changed',
      ].includes(error.code)
    )
      throw error;
    conflict = error.code;
  }
  await tx.mutate.change_request.update({
    id,
    status,
    voting_status: 'completed',
    resolution_method: options.resolutionMethod,
    resolved_in_mode: options.resolvedInMode,
    visibility_scope: options.visibilityScope,
    updated_at: options.now,
  });
  await recordDecision(tx, id, result, revisionId, conflict);
  return {
    changeRequest: cr,
    status,
    applicationStatus: conflict ? 'conflict' : 'applied',
    conflictReason: conflict,
  };
}
