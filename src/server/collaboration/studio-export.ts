import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import {
  validateExport,
  type StudioDocument,
} from '@/features/communication-studio/logic/document';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { assertActive, rows, sqlTransaction } from './transaction';
import { authorizeStored, isEmptyUpdate } from './service';
import { findStored } from './store';

export async function queueCommittedExport(
  actor: string,
  projectId: string,
  format: string,
  pageIds: string[],
  state: string
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await findStored(sql, {
      kind: 'studio',
      entityId: projectId,
      branchId: null,
      workspaceId: null,
    });
    if (!doc) throw new CollaborationError('canonical_document_missing');
    await authorizeStored(tx, actor, doc, undefined, true);
    if (!isEmptyUpdate(doc.state, Buffer.from(state, 'base64')))
      throw new CollaborationError('wait_for_saved_revision');
    const value = doc.projection as StudioDocument;
    if (
      validateExport(value).length ||
      pageIds.some(id => !value.pages.some(page => page.id === id))
    )
      throw new CollaborationError('invalid_export', 422);
    const [count] = await rows<{ n: number }>(
      sql,
      "select count(*)::int as n from studio_export where requested_by_id=$1 and status in ('queued','running')",
      [actor]
    );
    if (count.n >= 5) throw new CollaborationError('export_queue_full', 429);
    const [proof] = await rows<{ id: string }>(
      sql,
      'select id from collaboration_revision where document_id=$1 and revision=$2',
      [doc.id, doc.revision]
    );
    if (!proof) throw new CollaborationError('confirmed_revision_missing');
    const revisionId = crypto.randomUUID(),
      id = crypto.randomUUID(),
      now = Date.now();
    await sql.query(
      'insert into studio_revision(id,project_id,document,created_by_id,created_at,collaboration_revision_id) values($1,$2,$3::jsonb,$4,$5,$6)',
      [revisionId, projectId, value, actor, now, proof.id]
    );
    await sql.query(
      'insert into studio_export(id,project_id,revision_id,requested_by_id,format,page_ids,created_at,updated_at) values($1,$2,$3,$4,$5,$6::jsonb,$7,$7)',
      [id, projectId, revisionId, actor, format, pageIds, now]
    );
    return { id, revision: doc.revision };
  });
}
