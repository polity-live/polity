import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { CollaborationError, type DocumentKind } from '@/features/collaboration/logic/types';
import { reconcileProjection } from '@/features/collaboration/logic/reconcile';
import { findStored, createStored, commitState, checksum } from './store';
import { documentBranch, migrationState, rows, sqlTransaction } from './transaction';

export async function activeCollaboration(transaction: unknown) {
  const tx = transaction as Transaction<Schema>;
  return tx.location === 'server' && (await migrationState(sqlTransaction(tx))) === 'active';
}

export async function agendaHasConflicts(transaction: unknown, agendaId: string) {
  if (!(await activeCollaboration(transaction))) return false;
  const [conflict] = await rows(
    sqlTransaction(transaction as Transaction<Schema>),
    `select 1 from collaboration_proposal p
    join change_request c on c.id=p.change_request_id join agenda_item a on a.amendment_id=c.amendment_id
    where a.id=$1 and p.application_status='conflict' and (c.process_branch_id is null or
      exists(select 1 from amendment_process_step_run s where s.agenda_item_id=a.id and s.branch_id=c.process_branch_id) or
      exists(select 1 from agenda_item_change_request l where l.agenda_item_id=a.id and l.process_branch_id=c.process_branch_id)) limit 1`,
    [agendaId]
  );
  return !!conflict;
}

/** Server-only bridge for existing decision/repair transactions. Authorization
 * remains the caller's existing domain check. Never call for arbitrary client
 * document-save mutations. */
export async function commitGovernanceContent(
  transaction: unknown,
  actor: string,
  kind: DocumentKind,
  entityId: string,
  value: unknown,
  reason: string,
  operationId: string,
  branchId: string | null = null
) {
  const tx = transaction as Transaction<Schema>;
  if (tx.location !== 'server') return null;
  const sql = sqlTransaction(tx);
  if ((await migrationState(sql)) !== 'active') return null;
  if (kind === 'document') {
    branchId = await documentBranch(sql, entityId, branchId);
  }
  let doc = await findStored(sql, { kind, entityId, branchId, workspaceId: null });
  if (!doc) {
    const table = kind === 'city' ? 'amendment_city_design' : kind;
    if (kind === 'studio') throw new CollaborationError('canonical_document_missing');
    const [source] = await rows<{ content: unknown }>(
      sql,
      `select ${kind === 'city' ? 'design_state' : 'content'} as content from ${table} where id=$1`,
      [entityId]
    );
    if (!source) throw new CollaborationError('canonical_document_missing');
    doc = await createStored(
      sql,
      { kind, entityId, branchId, workspaceId: null },
      source.content,
      actor
    );
  }
  if (checksum(value) === doc.checksum) return null;
  return commitState(
    sql,
    doc,
    reconcileProjection(kind, doc.state, value),
    actor,
    operationId,
    reason
  );
}
export async function recordDecision(
  tx: Transaction<Schema>,
  changeRequestId: string,
  result: string,
  revisionId: string | null,
  conflict?: string
) {
  if (tx.location !== 'server') return;
  const sql = sqlTransaction(tx);
  if ((await migrationState(sql)) !== 'active') return;
  await sql.query(
    `update collaboration_proposal set decision_result=$1,application_status=$2,application_revision_id=$3,conflict_reason=$4 where change_request_id=$5`,
    [result, conflict ? 'conflict' : 'applied', revisionId, conflict ?? null, changeRequestId]
  );
}

export async function inspectDecision(
  tx: Transaction<Schema>,
  changeRequestId: string,
  result: string,
  currentSnapshot: unknown,
  retry = false
) {
  if (tx.location !== 'server') return 'apply' as const;
  const sql = sqlTransaction(tx);
  if ((await migrationState(sql)) !== 'active') return 'apply' as const;
  const [proposal] = await rows<{
    decision_result: string | null;
    checksum: string;
    application_status: string;
  }>(
    sql,
    'select decision_result,checksum,application_status from collaboration_proposal where change_request_id=$1 for update',
    [changeRequestId]
  );
  if (!proposal) throw new CollaborationError('submitted_revision_missing');
  if (proposal.decision_result) {
    if (proposal.decision_result !== result)
      throw new CollaborationError('decision_already_recorded');
    if (!retry || proposal.application_status !== 'conflict')
      return proposal.application_status === 'conflict'
        ? ('conflict' as const)
        : ('duplicate' as const);
  }
  if (!currentSnapshot || checksum(currentSnapshot) !== proposal.checksum) {
    await recordDecision(tx, changeRequestId, result, null, 'submitted_content_changed');
    return 'conflict' as const;
  }
  return 'apply' as const;
}

/** Legacy duplicate records share a ballot only when their immutable content
 * and document match. Applying the same text operation a second time is unsafe. */
export async function inheritGroupedDecision(
  tx: Transaction<Schema>,
  canonicalId: string,
  duplicateId: string
) {
  const sql = sqlTransaction(tx);
  const proofs = await rows<{
    change_request_id: string;
    document_id: string;
    checksum: string;
    decision_result: string | null;
    application_status: string;
    application_revision_id: string | null;
    conflict_reason: string | null;
  }>(
    sql,
    'select * from collaboration_proposal where change_request_id=any($1::uuid[]) for update',
    [[canonicalId, duplicateId]]
  );
  const source = proofs.find(proof => proof.change_request_id === canonicalId);
  const target = proofs.find(proof => proof.change_request_id === duplicateId);
  if (!source?.decision_result || !target)
    throw new CollaborationError('submitted_revision_missing');
  if (target.decision_result) {
    if (target.decision_result !== source.decision_result)
      throw new CollaborationError('decision_already_recorded');
    return;
  }
  const matching = source.document_id === target.document_id && source.checksum === target.checksum;
  await recordDecision(
    tx,
    duplicateId,
    source.decision_result,
    matching ? source.application_revision_id : null,
    matching ? (source.conflict_reason ?? undefined) : 'grouped_proposal_content_differs'
  );
}
