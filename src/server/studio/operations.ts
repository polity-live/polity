import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { rows, sqlTransaction, lockAuthority } from '@/server/transaction';
import { checksum } from '@/server/checksum';
import {
  studioDocumentV3Schema,
  type StudioDocumentV3,
} from '@/features/communication-studio/logic/document-v3';
import {
  mergeStudioV3,
  studioOperationSchema,
  type StudioConflict,
} from '@/features/communication-studio/logic/operations';
import { validateStudioAssetsInTransaction } from './assets';
import { z } from 'zod';
export interface StudioReceipt {
  operationId: string;
  status: 'applied' | 'conflict';
  revision: number;
  document: StudioDocumentV3;
  conflicts: StudioConflict[];
}
export async function applyStudioOperation(
  tx: Transaction<Schema>,
  actor: string,
  input: z.infer<typeof studioOperationSchema>
): Promise<StudioReceipt> {
  const args = studioOperationSchema.parse(input),
    sql = sqlTransaction(tx);
  await lockAuthority(sql);
  const [permission] = await rows<{ allowed: boolean; can_edit: boolean }>(
    sql,
    'select studio_access($1::uuid,$2::uuid,false) as allowed,studio_access($1::uuid,$2::uuid,true) as can_edit',
    [actor, args.projectId]
  );
  if (!permission?.allowed) throw new Error('Studio access denied');
  const hash = checksum(args);
  const [prior] = await rows<{ input_hash: string; result: StudioReceipt; actor_id: string }>(
    sql,
    'select input_hash,result,actor_id from studio_operation where id=$1',
    [args.operationId]
  );
  if (prior) {
    if (prior.input_hash !== hash || prior.actor_id !== actor)
      throw new Error('Operation ID reused');
    return prior.result;
  }
  if (!permission.can_edit) throw new Error('Studio access denied');
  const [control] = await rows<{ phase: string; generation: string }>(
    sql,
    'select phase,generation from canvas_control where project_id=$1 for update',
    [args.projectId]
  );
  if (!control || control.phase !== 'edit')
    throw new Error('Canvas phase does not allow direct editing');
  if (args.generation !== control.generation)
    throw new Error('Canvas generation changed; recover your draft');
  const [stored] = await rows<{ document: StudioDocumentV3; content_revision: number }>(
    sql,
    'select document,content_revision from studio_state where project_id=$1 for update',
    [args.projectId]
  );
  if (!stored) throw new Error('Studio project not found');
  if (
    args.expectedRevision === undefined ||
    args.expectedRevision > Number(stored.content_revision)
  )
    throw new Error('Invalid starting revision');
  const current = studioDocumentV3Schema.parse(stored.document);
  for (const node of current.nodes)
    if (node.locked) {
      const prefix = ['nodes', `#${node.id}`];
      if (
        args.changes.some(
          c =>
            c.path.every((v, i) => prefix[i] === v) ||
            (prefix.every((v, i) => c.path[i] === v) &&
              !(c.path.length === 3 && c.path[2] === 'locked' && c.after.value === false))
        )
      )
        throw new Error('Node is locked');
    }
  const merged = mergeStudioV3(current, args.changes);
  if (!merged.conflicts.length)
    await validateStudioAssetsInTransaction(sql, args.projectId, merged.value);
  const revision = Number(stored.content_revision) + (merged.conflicts.length ? 0 : 1);
  const result: StudioReceipt = {
    operationId: args.operationId,
    status: merged.conflicts.length ? 'conflict' : 'applied',
    revision,
    document: merged.value,
    conflicts: merged.conflicts,
  };
  const now = Date.now();
  if (result.status === 'applied') {
    await sql.query(
      'update studio_state set document=$2::jsonb,content_revision=$3,updated_at=$4 where project_id=$1',
      [args.projectId, merged.value, revision, now]
    );
    await sql.query('update studio_project set title=$2,kind=$3,updated_at=$4 where id=$1', [
      args.projectId,
      merged.value.title,
      merged.value.kind,
      now,
    ]);
  }
  await sql.query(
    'insert into studio_operation(id,project_id,actor_id,input_hash,changes,result,created_at) values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',
    [args.operationId, args.projectId, actor, hash, args.changes, result, now]
  );
  return result;
}
