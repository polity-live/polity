import * as Y from 'yjs';
import { commandReceipt } from './receipts';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { mergeProposal } from '@/features/collaboration/logic/proposals';
import { seedDocument, projectDocument } from '@/features/collaboration/logic/codec';
import { assertActive, rows, sqlTransaction } from './transaction';
import { authorizeStored, referenceOf } from './service';
import {
  checksum,
  commitState,
  createStored,
  loadStored,
  recordRevision,
  type StoredDocument,
} from './store';
import { reconcileProjection } from '@/features/collaboration/logic/reconcile';

export async function revisions(actor: string, id: string, generation: string) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    await authorizeStored(tx, actor, await loadStored(sql, id), generation);
    return rows(
      sql,
      'select id,revision,generation,checksum,projection,reason,created_at from collaboration_revision where document_id=$1 order by revision desc limit 100',
      [id]
    );
  });
}
/** Recovery never replaces the live document. A current authorization creates
 * a new private draft; the old offline generation cannot reconnect to main. */
export async function resumeDraft(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string,
  value: unknown
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await loadStored(sql, id),
      access = await authorizeStored(tx, actor, doc);
    if (!access.capabilities.suggest || doc.workspace_type !== 'canonical')
      throw new CollaborationError('suggestion_denied', 403);
    const receipt = await commandReceipt<{ workspaceId: string | null }>(
      sql,
      id,
      actor,
      operationId,
      { operation: 'resume', generation, expectedRevision, value }
    );
    if (receipt.previous) return receipt.previous;
    const reference = { ...referenceOf(doc), workspaceId: operationId };
    if (doc.generation !== generation || doc.revision !== expectedRevision)
      throw new CollaborationError('revision_changed');
    if (doc.kind === 'studio')
      await (
        await import('./studio-assets')
      ).validateStudioAssetsInTransaction(sql, doc.entity_id, value);
    const draft = await createStored(sql, reference, value, actor, { type: 'followup', base: doc });
    return receipt.record({ workspaceId: draft.workspace_id });
  });
}
export async function rebaseDraft(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const draft = await loadStored(sql, id);
    await authorizeStored(tx, actor, draft, undefined, true);
    const receipt = await commandReceipt<{ id: string; revision: number }>(
      sql,
      id,
      actor,
      operationId,
      { operation: 'rebase', generation, expectedRevision }
    );
    if (receipt.previous) return receipt.previous;
    if (draft.workspace_type === 'canonical' || !draft.base_document_id)
      throw new CollaborationError('workspace_required');
    if (draft.generation !== generation || draft.revision !== expectedRevision)
      throw new CollaborationError('revision_changed');
    const base = await loadStored(sql, draft.base_document_id);
    const [old] = await rows<{ projection: unknown }>(
      sql,
      'select projection from collaboration_revision where document_id=$1 and revision=$2',
      [base.id, draft.base_revision]
    );
    if (!old) throw new CollaborationError('base_revision_missing');
    const merged = mergeProposal(old.projection, draft.projection, base.projection),
      doc = seedDocument(draft.kind, merged);
    try {
      const next = {
        ...draft,
        generation: crypto.randomUUID(),
        revision: draft.revision + 1,
        projection: projectDocument(draft.kind, doc),
        state: Y.encodeStateAsUpdate(doc),
      };
      next.checksum = checksum(next.projection);
      await sql.query(
        'update collaboration_document set generation=$1,revision=$2,state=$3,projection=$4::jsonb,checksum=$5,base_revision=$6,updated_at=$7 where id=$8',
        [
          next.generation,
          next.revision,
          Buffer.from(next.state),
          next.projection,
          next.checksum,
          base.revision,
          Date.now(),
          id,
        ]
      );
      const revisionId = await recordRevision(sql, next, actor, `rebase:${operationId}`, 'rebase');
      return receipt.record({ id: revisionId, revision: next.revision });
    } finally {
      doc.destroy();
    }
  });
}

export async function publishDraftInTransaction(
  tx: ZeroTransaction,
  actor: string,
  draft: StoredDocument,
  generation: string,
  expectedRevision: number,
  operationId: string
) {
  const sql = sqlTransaction(tx);
  if (!draft.base_document_id) throw new CollaborationError('workspace_required');
  const base = await loadStored(sql, draft.base_document_id),
    access = await authorizeStored(tx, actor, base, undefined, true);
  if (access.amendmentId) throw new CollaborationError('decision_required');
  const requestHash = checksum({ draftId: draft.id, generation, expectedRevision });
  const [previous] = await rows<{
    actor_id: string;
    request_hash: string;
    result: { ids: string[] };
  }>(sql, 'select * from collaboration_command where document_id=$1 and operation_id=$2', [
    base.id,
    operationId,
  ]);
  if (previous) {
    if (previous.actor_id !== actor || previous.request_hash !== requestHash)
      throw new CollaborationError('operation_id_reused');
    return previous.result;
  }
  if (draft.frozen || draft.generation !== generation || draft.revision !== expectedRevision)
    throw new CollaborationError('revision_changed');
  const [old] = await rows<{ projection: unknown }>(
    sql,
    'select projection from collaboration_revision where document_id=$1 and revision=$2',
    [base.id, draft.base_revision]
  );
  if (!old) throw new CollaborationError('base_revision_missing');
  const merged = mergeProposal(old.projection, draft.projection, base.projection);
  const { suggestionIds } = await import('@/features/collaboration/logic/proposals');
  if ((base.kind === 'document' || base.kind === 'blog') && suggestionIds(merged).size)
    throw new CollaborationError('unresolved_draft_suggestions');
  let update: Uint8Array;
  if (base.kind === 'studio') {
    await (
      await import('./studio-assets')
    ).validateStudioAssetsInTransaction(sql, base.entity_id, merged);
    const { replaceStudioProjection } = await import('./replace');
    update = replaceStudioProjection(base.state, merged);
  } else update = reconcileProjection(base.kind, base.state, merged);
  await commitState(sql, base, update, actor, `publish:${operationId}`, 'publish_draft');
  await sql.query(
    'update collaboration_document set frozen=true,generation=gen_random_uuid() where id=$1',
    [draft.id]
  );
  await sql.query(
    'insert into collaboration_outbox(document_id,generation,revision,created_at) select id,generation,revision,$2 from collaboration_document where id=$1',
    [draft.id, Date.now()]
  );
  await sql.query(
    'insert into collaboration_command(document_id,operation_id,actor_id,request_hash,result,created_at) values($1,$2,$3,$4,$5::jsonb,$6)',
    [base.id, operationId, actor, requestHash, { ids: [] }, Date.now()]
  );
  return { ids: [] };
}
