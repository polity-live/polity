import { z } from 'zod';
import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { textValue } from '@/features/collaboration/logic/codec';
import { assertActive, rows, sqlTransaction } from './transaction';
import { authorizeStored } from './service';
import { checksum, loadStored } from './store';
import { zql } from '@/zero/schema';
import { applyChangeRequestVisibilityAccess } from '@/zero/rbac/query-access';

export const commentOperationSchema = z.object({
  id: z.string().min(1).max(200),
  threadId: z.string().min(1).max(200),
  expectedRevision: z.number().int().nonnegative(),
  content: z.unknown(),
  deleted: z.boolean().default(false),
  resolved: z.boolean().default(false),
  changeRequestId: z.string().uuid().optional(),
  objectId: z.string().min(1).max(200).optional(),
  visibility: z.enum(['document', 'collaborators']).default('document'),
});
interface CommentRow {
  id: string;
  thread_id: string;
  author_id: string;
  content: unknown;
  anchor: { nodeId?: string; mark: string; objectId?: string };
  revision: number;
  deleted: boolean;
  resolved: boolean;
  created_at: number;
  change_request_id: string | null;
  visibility: 'document' | 'collaborators';
}

export function commentAnchor(value: unknown, threadId: string): { nodeId?: string; mark: string } {
  let found: string | undefined;
  const visit = (n: unknown, parent?: string) => {
    if (Array.isArray(n)) return n.forEach(item => visit(item, parent));
    if (!n || typeof n !== 'object') return;
    const row = n as Record<string, unknown>,
      nodeId = typeof row.id === 'string' ? row.id : parent;
    if (row[`comment_${threadId}`]) found = nodeId;
    if (row.children) visit(row.children, nodeId);
  };
  visit(value);
  return { nodeId: found, mark: threadId };
}
export async function listComments(actor: string, id: string, generation: string) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await loadStored(sql, id);
    const access = await authorizeStored(tx, actor, doc, generation);
    const comments = await rows<CommentRow>(
      sql,
      'select * from collaboration_comment where document_id=$1 order by created_at,id',
      [id]
    );
    const allowed = access.amendmentId
      ? await tx.run(
          applyChangeRequestVisibilityAccess(
            zql.change_request.where('amendment_id', access.amendmentId),
            actor
          )
        )
      : [];
    const member = access.amendmentId
      ? await tx.run(
          zql.amendment_collaborator
            .where('amendment_id', access.amendmentId)
            .where('user_id', actor)
            .where('status', 'IN', ['active', 'collaborator', 'member', 'admin'])
            .one()
        )
      : access.capabilities.comment;
    return comments
      .filter(row =>
        row.change_request_id
          ? allowed.some(cr => cr.id === row.change_request_id)
          : row.visibility === 'document' || !!member
      )
      .map(row => ({
        ...row,
        revision: Number(row.revision),
        orphaned: row.anchor.objectId
          ? !((doc.projection as { objects?: { id: string }[] }).objects ?? []).some(
              object => object.id === row.anchor.objectId
            )
          : !commentAnchor(doc.projection, row.thread_id).nodeId,
      }));
  });
}
export async function changeComment(
  actor: string,
  id: string,
  generation: string,
  operationId: string,
  input: z.infer<typeof commentOperationSchema>
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await loadStored(sql, id),
      access = await authorizeStored(tx, actor, doc);
    if (!access.capabilities.comment) throw new CollaborationError('comment_denied', 403);
    const requestHash = checksum(input);
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
    const [old] = await rows<CommentRow>(
      sql,
      'select * from collaboration_comment where document_id=$1 and id=$2 for update',
      [id, input.id]
    );
    if (old && old.author_id !== actor && !access.capabilities.manage)
      throw new CollaborationError('comment_author_required', 403);
    if (Number(old?.revision ?? 0) !== input.expectedRevision)
      throw new CollaborationError('comment_revision_changed');
    if (old && old.thread_id !== input.threadId)
      throw new CollaborationError('comment_thread_immutable');
    if (
      old &&
      (old.change_request_id !== (input.changeRequestId ?? null) ||
        old.visibility !== input.visibility)
    )
      throw new CollaborationError('comment_scope_immutable');
    // Replies inherit the scope of the server-held thread, including deleted
    // comments. A new comment ID must not publish a private discussion.
    const [thread] = await rows<CommentRow>(
      sql,
      'select * from collaboration_comment where document_id=$1 and thread_id=$2 order by created_at,id limit 1',
      [id, input.threadId]
    );
    if (
      thread &&
      (thread.change_request_id !== (input.changeRequestId ?? null) ||
        thread.visibility !== input.visibility)
    )
      throw new CollaborationError('comment_scope_immutable');
    if (input.changeRequestId) {
      if (!access.amendmentId) throw new CollaborationError('comment_scope_invalid', 403);
      const proposal = await tx.run(
        applyChangeRequestVisibilityAccess(
          zql.change_request
            .where('id', input.changeRequestId)
            .where('amendment_id', access.amendmentId),
          actor
        ).one()
      );
      if (!proposal || (proposal.process_branch_id ?? null) !== doc.branch_id)
        throw new CollaborationError('comment_scope_invalid', 403);
    }
    if (
      input.objectId &&
      (doc.kind !== 'city' ||
        !(doc.projection as { objects: { id: string }[] }).objects.some(
          object => object.id === input.objectId
        ))
    )
      throw new CollaborationError('comment_target_missing', 422);
    const content = textValue(input.content),
      anchor =
        old?.anchor ??
        (input.objectId
          ? { mark: input.threadId, objectId: input.objectId }
          : commentAnchor(doc.projection, input.threadId));
    if (JSON.stringify(content).length > 100_000)
      throw new CollaborationError('comment_too_large', 422);
    const now = Date.now();
    const [saved] = await rows<CommentRow>(
      sql,
      `insert into collaboration_comment(document_id,id,thread_id,author_id,content,anchor,deleted,resolved,created_at,updated_at,change_request_id,visibility)
      values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$9,$10,$11) on conflict(document_id,id) do update set
      content=excluded.content,deleted=excluded.deleted,resolved=excluded.resolved,revision=collaboration_comment.revision+1,updated_at=excluded.updated_at returning *`,
      [
        id,
        input.id,
        input.threadId,
        actor,
        content,
        anchor,
        input.deleted,
        input.resolved,
        now,
        input.changeRequestId ?? null,
        input.visibility,
      ]
    );
    await sql.query(
      'insert into collaboration_comment_history(document_id,comment_id,revision,actor_id,snapshot,created_at) values($1,$2,$3,$4,$5::jsonb,$6)',
      [id, input.id, saved.revision, actor, saved, now]
    );
    await sql.query(
      'insert into collaboration_command(document_id,operation_id,actor_id,request_hash,result,created_at) values($1,$2,$3,$4,$5::jsonb,$6)',
      [id, operationId, actor, requestHash, saved, now]
    );
    return saved;
  });
}
