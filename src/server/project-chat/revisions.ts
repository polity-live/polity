import { throwAppError } from '@/features/shared/errors/app-error';
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { rows, sqlTransaction } from '@/server/transaction';
import { ProjectToolError } from '@/features/project-chat/logic/contracts';

export async function assertContentRevision(
  tx: Transaction<Schema>,
  kind: 'document' | 'amendment_city_design',
  id: string,
  expected: number | undefined
) {
  if (tx.location !== 'server') return;
  const sql = sqlTransaction(tx);
  // Table names are a closed internal union; identifiers never come from tools.
  const [row] = await rows<{ content_revision: number; amendment_id: string | null }>(
    sql,
    `select content_revision,amendment_id from ${kind} where id=$1 for update`,
    [id]
  );
  if (!row) throw new ProjectToolError('not_found');
  if (expected !== undefined && Number(row.content_revision) !== expected)
    throwAppError('project_revision_conflict');
  if (expected === undefined && row.amendment_id) {
    const [chat] = await rows(
      sql,
      "select id from conversation where amendment_id=$1 and type='project_ai' limit 1",
      [row.amendment_id]
    );
    if (chat) throw new ProjectToolError('revision_required', 'Reload the editor before saving.');
  }
}
