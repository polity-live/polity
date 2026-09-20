import * as Y from 'yjs';
import { commandReceipt } from './receipts';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { projectDocument, seedDocument } from '@/features/collaboration/logic/codec';
import { assertActive, rows, sqlTransaction } from './transaction';
import { authorizeStored } from './service';
import { checksum, loadStored, persistProjection, recordRevision } from './store';

/** Restore only a server-held version of this entity. The UI's JSON is a
 * selector for the existing version picker, never trusted replacement content. */
export async function restoreVersion(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string,
  value: unknown
) {
  return executeZeroTransaction(createZeroContext(actor), tx =>
    restoreVersionInTransaction(tx, actor, {
      id,
      generation,
      expectedRevision,
      operationId,
      value,
    })
  );
}

export async function restoreVersionInTransaction(
  tx: ZeroTransaction,
  actor: string,
  {
    id,
    generation,
    expectedRevision,
    operationId,
    value,
  }: {
    id: string;
    generation: string;
    expectedRevision: number;
    operationId: string;
    value: unknown;
  }
) {
  const sql = sqlTransaction(tx);
  await assertActive(sql);
  const doc = await loadStored(sql, id);
  const rights = await authorizeStored(tx, actor, doc, undefined, true);
  if (doc.workspace_type !== 'canonical' || !rights.capabilities.manage)
    throw new CollaborationError('restore_denied', 403);
  const receipt = await commandReceipt<{ id: string; revision: number }>(
    sql,
    id,
    actor,
    operationId,
    { operation: 'restore', generation, expectedRevision, value }
  );
  if (receipt.previous) return receipt.previous;
  if (doc.generation !== generation || doc.revision !== expectedRevision)
    throw new CollaborationError('revision_changed');
  const snapshots = await rows<{ id: string; content: unknown }>(
    sql,
    'select id,projection as content from collaboration_revision where document_id=$1',
    [id]
  );
  if (['document', 'blog'].includes(doc.kind))
    snapshots.push(
      ...(await rows<{ id: string; content: unknown }>(
        sql,
        `select id,content from document_version where ${doc.kind === 'blog' ? 'blog_id' : 'document_id'}=$1`,
        [doc.entity_id]
      ))
    );
  const snapshot = snapshots.find(entry => checksum(entry.content) === checksum(value));
  if (!snapshot) throw new CollaborationError('version_not_found', 404);
  const ydoc = seedDocument(doc.kind, snapshot.content);
  try {
    const projection = projectDocument(doc.kind, ydoc);
    const next = {
      ...doc,
      generation: crypto.randomUUID(),
      revision: doc.revision + 1,
      projection,
      checksum: checksum(projection),
      state: Y.encodeStateAsUpdate(ydoc),
    };
    await sql.query(
      'update collaboration_document set generation=$1,revision=$2,state=$3,projection=$4::jsonb,checksum=$5,updated_at=$6 where id=$7',
      [
        next.generation,
        next.revision,
        Buffer.from(next.state),
        projection,
        next.checksum,
        Date.now(),
        id,
      ]
    );
    const revisionId = await recordRevision(
      sql,
      next,
      actor,
      `restore:${operationId}`,
      `restore:${snapshot.id}`
    );
    await persistProjection(sql, next);
    // Existing proposals keep their proof; changed targets require an explicit
    // resolution instead of silently moving votes to the restored text.
    await sql.query(
      "update collaboration_proposal set application_status='conflict',conflict_reason='target_generation_restored' where document_id=$1 and application_status='pending'",
      [id]
    );
    return receipt.record({ id: revisionId, revision: next.revision });
  } finally {
    ydoc.destroy();
  }
}
