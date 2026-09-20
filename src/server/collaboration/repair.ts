import { commandReceipt } from './receipts';
import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { assertActive, sqlTransaction } from './transaction';
import { loadStored, persistProjection, recordRevision, verifiedRevision } from './store';
import { authorizeStored } from './service';

/** Repairs can only select a server-verified immutable revision. */
export async function repairDocument(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await loadStored(sql, id, true),
      access = await authorizeStored(tx, actor, doc);
    if (!access.capabilities.manage || doc.workspace_type !== 'canonical')
      throw new CollaborationError('repair_denied', 403);
    const receipt = await commandReceipt<{ id: string; revision: number }>(
      sql,
      id,
      actor,
      operationId,
      { operation: 'repair', generation, expectedRevision }
    );
    if (receipt.previous) return receipt.previous;
    if (doc.generation !== generation || doc.revision !== expectedRevision)
      throw new CollaborationError('revision_changed');
    if (!doc.integrity_error) throw new CollaborationError('repair_not_required');
    const verified = await verifiedRevision(sql, doc),
      next = {
        ...doc,
        ...verified,
        revision: doc.revision + 1,
        generation: crypto.randomUUID(),
        integrity_error: null,
      };
    await sql.query(
      'update collaboration_document set state=$2,projection=$3::jsonb,checksum=$4,revision=$5,generation=$6,integrity_error=null,integrity_checked_at=$7,updated_at=$7 where id=$1',
      [
        id,
        Buffer.from(next.state),
        next.projection,
        next.checksum,
        next.revision,
        next.generation,
        Date.now(),
      ]
    );
    const revisionId = await recordRevision(
      sql,
      next,
      actor,
      `repair:${operationId}`,
      `integrity_repair:verified_revision:${verified.revision}`
    );
    await persistProjection(sql, next);
    return receipt.record({ id: revisionId, revision: next.revision });
  });
}
