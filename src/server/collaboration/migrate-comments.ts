import { z } from 'zod';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { textValue } from '@/features/collaboration/logic/codec';
import { commentAnchor } from './comments';
import { rows, type SqlTransaction } from './transaction';
import type { StoredDocument } from './store';

const discussionSchema = z.array(
  z.object({
    id: z.string().min(1).max(200),
    changeRequestEntityId: z.string().uuid().optional(),
    visibilityScope: z.string().nullable().optional(),
    isResolved: z.boolean().optional(),
    comments: z.array(
      z.object({
        id: z.string().min(1).max(200),
        userId: z.string().uuid(),
        contentRich: z.unknown(),
        createdAt: z.union([z.string(), z.number()]),
      })
    ),
  })
);
/** Keep original authors, IDs and visibility; malformed history blocks release. */
export async function migrateComments(sql: SqlTransaction, doc: StoredDocument, input: unknown) {
  if (input == null) return;
  const parsed = discussionSchema.safeParse(input);
  if (!parsed.success) throw new CollaborationError(`ambiguous_discussions:${doc.entity_id}`);
  for (const thread of parsed.data) {
    let changeRequestId = thread.changeRequestEntityId ?? null;
    if (!changeRequestId) {
      const [cr] = await rows<{ id: string }>(
        sql,
        `select c.id from change_request c join amendment a on a.id=c.amendment_id left join amendment_process_branch b on b.id=c.process_branch_id
      where coalesce(b.document_id,a.document_id)=$1 and c.suggestion_id=$2`,
        [doc.entity_id, thread.id]
      );
      changeRequestId = cr?.id ?? null;
    }
    for (const comment of thread.comments) {
      const [author] = await rows(sql, 'select id from "user" where id=$1', [comment.userId]);
      const createdAt = new Date(comment.createdAt).getTime();
      if (!author || !Number.isFinite(createdAt))
        throw new CollaborationError(`ambiguous_comment:${comment.id}`);
      const [saved] = await rows(
        sql,
        `insert into collaboration_comment(document_id,id,thread_id,author_id,content,anchor,resolved,created_at,updated_at,change_request_id,visibility)
        values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$8,$9,$10) on conflict(document_id,id) do nothing returning *`,
        [
          doc.id,
          comment.id,
          thread.id,
          comment.userId,
          textValue(comment.contentRich),
          commentAnchor(doc.projection, thread.id),
          thread.isResolved ?? false,
          createdAt,
          changeRequestId,
          thread.visibilityScope === 'collaborators' ? 'collaborators' : 'document',
        ]
      );
      if (saved)
        await sql.query(
          'insert into collaboration_comment_history(document_id,comment_id,revision,actor_id,snapshot,created_at) values($1,$2,1,$3,$4::jsonb,$5)',
          [doc.id, comment.id, comment.userId, saved, createdAt]
        );
    }
  }
}
