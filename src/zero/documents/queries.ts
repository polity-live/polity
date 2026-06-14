import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { applyDocumentQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';

export const documentQueries = {
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyDocumentQueryAccess(zql.document.where('id', id), userID).related('amendment').one()
  ),

  versions: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.document_version
        .where('document_id', document_id)
        .whereExists('document', q => applyDocumentQueryAccess(q, userID))
        .related('author')
        .orderBy('version_number', 'desc')
  ),

  collaborators: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.document_collaborator
        .where('document_id', document_id)
        .whereExists('document', q => applyDocumentQueryAccess(q, userID))
        .related('user')
        .orderBy('created_at', 'desc')
  ),

  threads: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.thread
        .where('document_id', document_id)
        .whereExists('document', q => applyDocumentQueryAccess(q, userID))
        .orderBy('created_at', 'desc')
  ),

  comments: defineQuery(
    z.object({ thread_id: z.string() }),
    ({ args: { thread_id }, ctx: { userID } }) =>
      zql.comment
        .where('thread_id', thread_id)
        .whereExists('thread', thread =>
          thread.whereExists('document', document => applyDocumentQueryAccess(document, userID))
        )
        .orderBy('created_at', 'asc')
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type DocumentVersionRow = QueryRowType<typeof documentQueries.versions>;
export type DocumentCollaboratorRow = QueryRowType<typeof documentQueries.collaborators>;
