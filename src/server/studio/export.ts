import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import { validateExport } from '@/features/communication-studio/logic/document';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { v3DocumentToLegacy } from '@/features/communication-studio/logic/v3-adapter';
export async function queueCommittedExport(
  actor: string,
  projectId: string,
  format: string,
  pageIds: string[],
  revision: number,
  operationId?: string
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    const [access] = await rows<{ allowed: boolean }>(
      sql,
      'select studio_access($1::uuid,$2::uuid,true) as allowed',
      [actor, projectId]
    );
    if (!access?.allowed) throw new Error('Studio access denied');
    const [row] = await rows<{ document: unknown; content_revision: number }>(
      sql,
      'select document,content_revision from studio_state where project_id=$1 for update',
      [projectId]
    );
    if (!row || Number(row.content_revision) !== revision)
      throw new Error('wait_for_saved_revision');
    const value = studioDocumentV3Schema.parse(row.document);
    const legacy = v3DocumentToLegacy(value);
    if (
      validateExport(legacy).length ||
      pageIds.some(id => !value.nodes.some(node => node.type === 'frame' && node.id === id))
    )
      throw new Error('invalid_export');
    if (operationId) {
      const [prior] = await rows<{ id: string }>(
        sql,
        'select id from studio_export where id=$1 and project_id=$2 and requested_by_id=$3',
        [operationId, projectId, actor]
      );
      if (prior) return { id: prior.id, revision };
    }
    const [count] = await rows<{ n: number }>(
      sql,
      "select count(*)::int as n from studio_export where requested_by_id=$1 and status in ('queued','running')",
      [actor]
    );
    if (count.n >= 5) throw new Error('export_queue_full');
    const revisionId = crypto.randomUUID(),
      id = operationId ?? crypto.randomUUID(),
      now = Date.now();
    await sql.query(
      'insert into studio_revision(id,project_id,document,created_by_id,created_at,content_revision) values($1,$2,$3::jsonb,$4,$5,$6)',
      [revisionId, projectId, value, actor, now, revision]
    );
    await sql.query(
      'insert into studio_export(id,project_id,revision_id,requested_by_id,format,page_ids,created_at,updated_at) values($1,$2,$3,$4,$5,$6::jsonb,$7,$7)',
      [id, projectId, revisionId, actor, format, pageIds, now]
    );
    return { id, revision };
  });
}
