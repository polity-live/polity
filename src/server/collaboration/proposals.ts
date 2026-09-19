import { commandReceipt } from './receipts';
import type { Value } from 'platejs';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { zql } from '@/zero/schema';
import { createChangeRequestSchema } from '@/zero/change-requests/schema';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import { validateTextProposal } from '@/features/collaboration/logic/proposals';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { authorizeStored } from './service';
import { assertActive, rows, sqlTransaction } from './transaction';
import { checksum, loadStored } from './store';
import { publishDraftInTransaction } from './recovery';

export async function submitWorkspace(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string
) {
  return executeZeroTransaction(createZeroContext(actor), tx =>
    submitWorkspaceInTransaction(tx, actor, id, generation, expectedRevision, operationId)
  );
}
export async function submitWorkspaceInTransaction(
  tx: ZeroTransaction,
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string
) {
  const ctx = createZeroContext(actor);
  const sql = sqlTransaction(tx);
  await assertActive(sql);
  const draft = await loadStored(sql, id);
  const access = await authorizeStored(tx, actor, draft);
  if (draft.workspace_type === 'canonical' || !draft.base_document_id)
    throw new CollaborationError('proposal_requires_amendment', 422);
  if (!access.amendmentId)
    return publishDraftInTransaction(tx, actor, draft, generation, expectedRevision, operationId);
  if (!access.capabilities.suggest) throw new CollaborationError('suggestion_denied', 403);
  const receipt = await commandReceipt<{ ids: string[] }>(sql, draft.id, actor, operationId, {
    operation: 'submit',
    generation,
    expectedRevision,
  });
  if (receipt.previous) return receipt.previous;
  if (draft.generation !== generation) throw new CollaborationError('generation_changed');
  if (!access.capabilities.edit || draft.frozen) throw new CollaborationError('write_denied', 403);
  if (!['edit', 'suggest_internal', 'suggest_event'].includes(access.mode))
    throw new CollaborationError('submission_phase_closed');
  if (draft.revision !== expectedRevision) throw new CollaborationError('revision_changed');
  const base = await loadStored(sql, draft.base_document_id);
  if (base.revision !== Number(draft.base_revision))
    throw new CollaborationError('proposal_base_changed');
  const [baseRevision] = await rows<{ id: string }>(
    sql,
    'select id from collaboration_revision where document_id=$1 and revision=$2',
    [base.id, base.revision]
  );
  const [draftRevision] = await rows<{ id: string }>(
    sql,
    'select id from collaboration_revision where document_id=$1 and revision=$2',
    [draft.id, draft.revision]
  );
  if (!baseRevision || !draftRevision) throw new CollaborationError('submitted_revision_missing');
  const { amendmentServerMutators } = await import('@/zero/amendments/server-mutators');
  const requests: ReturnType<typeof createChangeRequestSchema.parse>[] = [];
  if (draft.kind === 'document') {
    const ids = validateTextProposal(base.projection as Value, draft.projection as Value);
    for (const [index, suggestionId] of ids.entries()) {
      const crId = index === 0 ? operationId : crypto.randomUUID();
      const snapshot = createChangeRequestDiffSnapshot(suggestionId, draft.projection as Value);
      if (!snapshot.change_type) throw new CollaborationError('invalid_proposal', 422);
      requests.push(
        createChangeRequestSchema.parse({
          id: crId,
          amendment_id: access.amendmentId,
          process_branch_id: base.branch_id,
          discussion_id: suggestionId,
          title: null,
          description: '',
          status: 'open',
          reason: null,
          source_type: null,
          source_id: null,
          source_title: null,
          ...snapshot,
          voting_status: 'open',
          voting_deadline: null,
          voting_majority_type: null,
          quorum_required: null,
        })
      );
    }
  } else if (draft.kind === 'city') {
    const { createCityDesignChangeRequestPayloads } =
      await import('@/features/amendments/city-design/logic/cityDesignChangeRequestDiff');
    const payloads = createCityDesignChangeRequestPayloads({
      amendmentId: access.amendmentId,
      processBranchId: base.branch_id,
      cityDesignId: base.entity_id,
      baseDesign: base.projection as Parameters<
        typeof createCityDesignChangeRequestPayloads
      >[0]['baseDesign'],
      draftDesign: draft.projection as Parameters<
        typeof createCityDesignChangeRequestPayloads
      >[0]['draftDesign'],
    });
    requests.push(...payloads.map(payload => createChangeRequestSchema.parse(payload)));
    if (!requests.length) throw new CollaborationError('proposal_has_no_changes', 422);
  } else throw new CollaborationError('unsupported_proposal', 422);
  for (const request of requests) {
    await sql.query("select set_config('polity.collaboration_draft',$1,true)", [draft.id]);
    await amendmentServerMutators.createChangeRequest.fn({ tx, ctx, args: request });
    await sql.query("select set_config('polity.collaboration_draft','',true)", []);
    const submitted =
      draft.kind === 'city'
        ? {
            source_type: request.source_type,
            source_id: request.source_id,
            original_properties: request.original_properties,
            new_properties: request.new_properties,
          }
        : createChangeRequestDiffSnapshot(
            request.discussion_id as string,
            draft.projection as Value
          );
    await sql.query(
      `insert into collaboration_proposal(change_request_id,document_id,base_revision_id,submitted_revision_id,submitted_content,checksum,created_at)
        values($1,$2,$3,$4,$5::jsonb,$6,$7) on conflict(change_request_id) do nothing`,
      [
        request.id,
        base.id,
        baseRevision.id,
        draftRevision.id,
        submitted,
        checksum(submitted),
        Date.now(),
      ]
    );
  }
  await sql.query(
    'update collaboration_document set frozen=true,generation=gen_random_uuid() where id=$1',
    [draft.id]
  );
  await sql.query(
    'insert into collaboration_outbox(document_id,generation,revision,created_at) select id,generation,revision,$2 from collaboration_document where id=$1',
    [draft.id, Date.now()]
  );
  return receipt.record({ ids: requests.map(request => request.id) });
}

export async function registerSuggestion(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  changeRequestId: string,
  suggestionId: string
) {
  // Kept as an explicit compatibility error for stale editor clients.
  void [actor, id, generation, expectedRevision, changeRequestId, suggestionId];
  throw new CollaborationError('proposal_requires_workspace', 422);
}

export async function resolveDirectly(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  changeRequestId: string,
  result: 'accepted' | 'rejected',
  operationId: string
) {
  return executeZeroTransaction(createZeroContext(actor), async (tx, ctx) => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await loadStored(sql, id);
    const access = await authorizeStored(tx, actor, doc);
    const cr = await tx.run(zql.change_request.where('id', changeRequestId).one());
    if (
      doc.workspace_type !== 'canonical' ||
      !cr ||
      cr.amendment_id !== access.amendmentId ||
      (cr.process_branch_id ?? null) !== doc.branch_id
    )
      throw new CollaborationError('invalid_proposal', 403);
    if (!access.capabilities.manage) throw new CollaborationError('decision_denied', 403);
    const requestHash = checksum({ generation, expectedRevision, changeRequestId, result });
    const [receipt] = await rows<{ actor_id: string; request_hash: string; result: unknown }>(
      sql,
      'select * from collaboration_command where document_id=$1 and operation_id=$2',
      [id, operationId]
    );
    if (receipt) {
      if (receipt.actor_id !== actor || receipt.request_hash !== requestHash)
        throw new CollaborationError('operation_id_reused');
      return receipt.result;
    }
    if (doc.generation !== generation) throw new CollaborationError('generation_changed');
    if (!['edit', 'suggest_internal'].includes(access.mode))
      throw new CollaborationError('decision_requires_vote', 403);
    if (doc.revision !== expectedRevision) throw new CollaborationError('revision_changed');
    const { amendmentServerMutators } = await import('@/zero/amendments/server-mutators');
    await amendmentServerMutators.updateChangeRequest.fn({
      tx,
      ctx,
      args: { id: changeRequestId, status: result },
    });
    const [proof] = await rows<{
      application_status: string;
      conflict_reason: string | null;
      decision_result: string | null;
    }>(
      sql,
      'select application_status,conflict_reason,decision_result from collaboration_proposal where change_request_id=$1',
      [changeRequestId]
    );
    if (!proof) throw new CollaborationError('submitted_revision_missing');
    const response = {
      id: changeRequestId,
      decisionResult: proof.decision_result,
      applicationStatus: proof.application_status,
      conflictReason: proof.conflict_reason,
    };
    await sql.query(
      'insert into collaboration_command(document_id,operation_id,actor_id,request_hash,result,created_at) values($1,$2,$3,$4,$5::jsonb,$6)',
      [id, operationId, actor, requestHash, response, Date.now()]
    );
    return response;
  });
}
