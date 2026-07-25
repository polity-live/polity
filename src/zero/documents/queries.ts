import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { applyDocumentQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

const documentStartSchema = z.object({ updated_at: z.number(), id: z.string() }).nullable();
const DOCUMENT_ROOT_ACCESS_PROFILE = {
  collaboratorFlip: false,
  amendmentFlip: false,
} as const;
const DOCUMENT_CHILD_ACCESS_PROFILE = {
  collaboratorFlip: true,
  amendmentFlip: true,
} as const;

export const documentQueries = {
  pageByGroup: defineQuery(
    z.object({
      groupId: z.string(),
      query: z.string().default(''),
      collaboratorId: z.string().optional(),
      status: z.string().optional(),
      limit: virtualPageLimitSchema,
      start: documentStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { groupId, query, collaboratorId, status, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = applyDocumentQueryAccess(zql.document, userID, DOCUMENT_ROOT_ACCESS_PROFILE)
        .whereExists('amendment', (amendment: any) => amendment.where('group_id', groupId), {
          flip: true,
        })
        .related('amendment')
        .related('collaborators', (collaborator: any) => collaborator.related('user'));
      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        q = q.whereExists(
          'amendment',
          (amendment: any) => amendment.where('title', 'ILIKE', `%${normalizedQuery}%`),
          { flip: true }
        );
      }
      if (collaboratorId)
        q = q.whereExists(
          'collaborators',
          (collaborator: any) => collaborator.where('user_id', collaboratorId),
          { flip: true }
        );
      if (status)
        q = q.whereExists(
          'amendment',
          (amendment: any) =>
            amendment.whereExists(
              'current_process_run',
              (run: any) => run.where('status', status),
              { flip: false }
            ),
          { flip: true }
        );
      q = q.orderBy('updated_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyDocumentQueryAccess(zql.document.where('id', id), userID, DOCUMENT_ROOT_ACCESS_PROFILE)
      .related('amendment')
      .one()
  ),

  versions: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.document_version
        .where('document_id', document_id)
        .whereExists(
          'document',
          q => applyDocumentQueryAccess(q, userID, DOCUMENT_CHILD_ACCESS_PROFILE),
          { flip: false }
        )
        .related('author')
        .orderBy('version_number', 'desc')
  ),

  collaborators: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.document_collaborator
        .where('document_id', document_id)
        .whereExists(
          'document',
          q => applyDocumentQueryAccess(q, userID, DOCUMENT_CHILD_ACCESS_PROFILE),
          { flip: false }
        )
        .related('user')
        .orderBy('created_at', 'desc')
  ),

  threads: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.thread
        .where('document_id', document_id)
        .whereExists(
          'document',
          q => applyDocumentQueryAccess(q, userID, DOCUMENT_CHILD_ACCESS_PROFILE),
          { flip: false }
        )
        .orderBy('created_at', 'desc')
  ),

  comments: defineQuery(
    z.object({ thread_id: z.string() }),
    ({ args: { thread_id }, ctx: { userID } }) =>
      zql.comment
        .where('thread_id', thread_id)
        .whereExists(
          'thread',
          thread =>
            thread.whereExists(
              'document',
              document => applyDocumentQueryAccess(document, userID, DOCUMENT_CHILD_ACCESS_PROFILE),
              { flip: false }
            ),
          { flip: false }
        )
        .orderBy('created_at', 'asc')
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type DocumentVersionRow = QueryRowType<typeof documentQueries.versions>;
export type DocumentCollaboratorRow = QueryRowType<typeof documentQueries.collaborators>;
export type GroupDocumentPageRow = QueryRowType<typeof documentQueries.pageByGroup>;
