import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import { PermissionError, isPermissionError } from '../rbac/errors';
import { zql } from '../schema';
import {
  createDocumentSchema,
  updateDocumentSchema,
  updateGroupDocumentTitleSchema,
  deleteDocumentSchema,
  createDocumentVersionSchema,
  updateDocumentVersionSchema,
  deleteDocumentVersionSchema,
  createDocumentCollaboratorSchema,
} from './schema';
import {
  createThreadSchema,
  createCommentSchema,
  updateThreadSchema,
  updateCommentSchema,
} from '../discussions/schema';
import {
  createThreadVoteSchema,
  updateThreadVoteSchema,
  deleteThreadVoteSchema,
  createCommentVoteSchema,
  updateCommentVoteSchema,
  deleteCommentVoteSchema,
} from '../votes/schema';

async function loadDocumentScope(tx: Parameters<typeof can>[0], documentId: string) {
  const document = await tx.run(zql.document.where('id', documentId).one());
  if (!document) {
    throw new Error('Document not found');
  }

  if (!document.amendment_id) {
    return { document, amendment: null, groupId: null };
  }

  const amendment = await tx.run(zql.amendment.where('id', document.amendment_id).one());
  if (!amendment) {
    throw new Error('Amendment not found');
  }

  return {
    document,
    amendment,
    groupId: amendment.group_id ?? null,
  };
}

async function authorizeDocumentGroupManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  documentId: string
) {
  const scope = await loadDocumentScope(tx, documentId);

  if (scope.document.amendment_id) {
    try {
      await can(tx, ctx, {
        action: 'update',
        resource: 'documents',
        amendmentId: scope.document.amendment_id,
      });
      return scope;
    } catch (error) {
      if (!isPermissionError(error) || !scope.groupId) {
        throw error;
      }

      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupDocuments',
        groupId: scope.groupId,
      });
      return scope;
    }
  }

  requireAuthenticated(tx, ctx, { action: 'update', resource: 'documents' });
  const collaborator = await tx.run(
    zql.document_collaborator
      .where('document_id', documentId)
      .where('user_id', ctx.userID)
      .where('status', 'active')
      .one()
  );
  if (!collaborator) {
    throw new PermissionError('update', 'documents', `document:${documentId}`);
  }

  return scope;
}

async function authorizeDocumentCreateForAmendment(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  amendmentId: string | null | undefined
) {
  if (tx.location === 'client') return;

  if (!amendmentId) {
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'documents' });
    return;
  }

  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    throw new Error('Amendment not found');
  }

  try {
    await can(tx, ctx, {
      action: 'update',
      resource: 'documents',
      amendmentId,
    });
  } catch (error) {
    if (!isPermissionError(error) || !amendment.group_id) {
      throw error;
    }

    await can(tx, ctx, {
      action: 'manage',
      resource: 'groupDocuments',
      groupId: amendment.group_id,
    });
  }
}

async function authorizeThreadParentAccess(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  thread: NonNullable<Awaited<ReturnType<typeof authorizeDocumentScopeByThread>>>,
  action: 'create' | 'update' | 'delete' | 'view' = 'view'
) {
  if (tx.location === 'client') return;

  if (thread.document_id) {
    await authorizeDocumentGroupManage(tx, ctx, thread.document_id);
    return;
  }

  if (thread.amendment_id) {
    await can(tx, ctx, { action, resource: 'threads', amendmentId: thread.amendment_id });
    return;
  }

  if (thread.blog_id) {
    await can(tx, ctx, {
      action: action === 'view' ? 'view' : 'update',
      resource: 'blogs',
      blogId: thread.blog_id,
    });
    return;
  }

  if (thread.statement_id) {
    const statement = await tx.run(zql.statement.where('id', thread.statement_id).one());
    requireOwner(tx, ctx, statement?.user_id, { action: 'update', resource: 'statements' });
    return;
  }

  throw new PermissionError(action, 'threads', `thread:${thread.id}`);
}

async function authorizeThreadAuthorOrParentManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  threadId: string,
  action: 'update' | 'delete'
) {
  if (tx.location === 'client') return;

  const thread = await authorizeDocumentScopeByThread(tx, ctx, threadId);
  if (thread.user_id === ctx.userID) {
    requireOwner(tx, ctx, thread.user_id, { action, resource: 'threads' });
    return;
  }

  await authorizeThreadParentAccess(tx, ctx, thread, action);
}

async function authorizeCommentAuthorOrParentManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  commentId: string,
  action: 'update' | 'delete'
) {
  if (tx.location === 'client') return;

  const comment = await tx.run(zql.comment.where('id', commentId).one());
  if (!comment) {
    throw new Error('Comment not found');
  }

  if (comment.user_id === ctx.userID) {
    requireOwner(tx, ctx, comment.user_id, { action, resource: 'comments' });
    return;
  }

  const thread = await authorizeDocumentScopeByThread(tx, ctx, comment.thread_id);
  await authorizeThreadParentAccess(tx, ctx, thread, action);
}

async function authorizeDocumentScopeByThread(
  tx: Parameters<typeof can>[0],
  _ctx: Parameters<typeof can>[1],
  threadId: string
) {
  const thread = await tx.run(zql.thread.where('id', threadId).one());
  if (!thread) {
    throw new Error('Thread not found');
  }

  return thread;
}

async function authorizeDocumentScopeByComment(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  commentId: string
) {
  const comment = await tx.run(zql.comment.where('id', commentId).one());
  if (!comment) {
    throw new Error('Comment not found');
  }

  await authorizeDocumentScopeByThread(tx, ctx, comment.thread_id);
  return comment;
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const documentSharedMutators = {
  // Create a document
  create: defineMutator(createDocumentSchema, async ({ tx, ctx, args }) => {
    await authorizeDocumentCreateForAmendment(tx, ctx, args.amendment_id);

    const now = Date.now();
    await tx.mutate.document.insert({
      ...args,
      created_at: now,
      updated_at: now,
    });
  }),

  // Update document content
  updateContent: defineMutator(updateDocumentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      await authorizeDocumentGroupManage(tx, ctx, args.id);
    }

    await tx.mutate.document.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  updateGroupDocumentTitle: defineMutator(
    updateGroupDocumentTitleSchema,
    async ({ tx, ctx, args }) => {
      let amendmentId: string | null | undefined = null;

      if (tx.location !== 'client') {
        const scope = await authorizeDocumentGroupManage(tx, ctx, args.document_id);
        amendmentId = scope.document.amendment_id;
      }

      if (!amendmentId) {
        const document = await tx.run(zql.document.where('id', args.document_id).one());
        amendmentId = document?.amendment_id;
      }

      if (!amendmentId) {
        throw new Error('Cannot save group document title: missing parent amendment id');
      }

      await tx.mutate.amendment.update({
        id: amendmentId,
        title: args.title,
        updated_at: Date.now(),
      });
    }
  ),

  createVersion: defineMutator(createDocumentVersionSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client' && args.document_id) {
      await authorizeDocumentGroupManage(tx, ctx, args.document_id);
    }

    const now = Date.now();
    await tx.mutate.document_version.insert({
      ...args,
      author_id: ctx.userID,
      created_at: now,
    });
  }),

  addCollaborator: defineMutator(createDocumentCollaboratorSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      await authorizeDocumentGroupManage(tx, ctx, args.document_id);
    }

    const now = Date.now();
    await tx.mutate.document_collaborator.insert({
      ...args,
      created_at: now,
    });
  }),

  createThread: defineMutator(createThreadSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      if (args.document_id) {
        await authorizeDocumentGroupManage(tx, ctx, args.document_id);
      } else if (args.amendment_id) {
        await can(tx, ctx, {
          action: 'create',
          resource: 'threads',
          amendmentId: args.amendment_id,
        });
      } else if (args.blog_id) {
        await can(tx, ctx, { action: 'view', resource: 'blogs', blogId: args.blog_id });
      } else if (args.statement_id) {
        const statement = await tx.run(zql.statement.where('id', args.statement_id).one());
        requireOwner(tx, ctx, statement?.user_id, { action: 'update', resource: 'statements' });
      } else {
        throw new PermissionError('create', 'threads', 'missing parent');
      }
    }

    const now = Date.now();
    await tx.mutate.thread.insert({
      ...args,
      user_id: ctx.userID,
      upvotes: 0,
      downvotes: 0,
      created_at: now,
      updated_at: now,
    });
  }),

  addComment: defineMutator(createCommentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const thread = await authorizeDocumentScopeByThread(tx, ctx, args.thread_id);
      await authorizeThreadParentAccess(tx, ctx, thread, 'create');
    }

    const now = Date.now();
    await tx.mutate.comment.insert({
      ...args,
      user_id: ctx.userID,
      upvotes: 0,
      downvotes: 0,
      created_at: now,
      updated_at: now,
    });
  }),

  voteThread: defineMutator(createThreadVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const thread = await authorizeDocumentScopeByThread(tx, ctx, args.thread_id);
      await authorizeThreadParentAccess(tx, ctx, thread, 'view');
    }

    const now = Date.now();
    await tx.mutate.thread_vote.insert({
      ...args,
      user_id: ctx.userID,
      created_at: now,
    });
  }),

  voteComment: defineMutator(createCommentVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const comment = await authorizeDocumentScopeByComment(tx, ctx, args.comment_id);
      const thread = await authorizeDocumentScopeByThread(tx, ctx, comment.thread_id);
      await authorizeThreadParentAccess(tx, ctx, thread, 'view');
    }

    const now = Date.now();
    await tx.mutate.comment_vote.insert({
      ...args,
      user_id: ctx.userID,
      created_at: now,
    });
  }),

  // Delete a document
  delete: defineMutator(deleteDocumentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      await authorizeDocumentGroupManage(tx, ctx, args.id);
    }

    await tx.mutate.document.delete({ id: args.id });
  }),

  // Update a document version
  updateVersion: defineMutator(updateDocumentVersionSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const version = await tx.run(zql.document_version.where('id', args.id).one());
      if (!version) {
        throw new Error('Document version not found');
      }

      if (version.document_id) {
        await authorizeDocumentGroupManage(tx, ctx, version.document_id);
      }
    }

    await tx.mutate.document_version.update(args);
  }),

  // Delete a document version
  deleteVersion: defineMutator(deleteDocumentVersionSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const version = await tx.run(zql.document_version.where('id', args.id).one());
      if (!version) {
        throw new Error('Document version not found');
      }

      if (version.document_id) {
        await authorizeDocumentGroupManage(tx, ctx, version.document_id);
      }
    }

    await tx.mutate.document_version.delete({ id: args.id });
  }),

  // Update a comment vote
  updateCommentVote: defineMutator(updateCommentVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const commentVote = await tx.run(zql.comment_vote.where('id', args.id).one());
      if (!commentVote) {
        throw new Error('Comment vote not found');
      }

      requireOwner(tx, ctx, commentVote.user_id, { action: 'update', resource: 'commentVotes' });
    }

    await tx.mutate.comment_vote.update(args);
  }),

  // Delete a comment vote
  deleteCommentVote: defineMutator(deleteCommentVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const commentVote = await tx.run(zql.comment_vote.where('id', args.id).one());
      if (!commentVote) {
        throw new Error('Comment vote not found');
      }

      requireOwner(tx, ctx, commentVote.user_id, { action: 'delete', resource: 'commentVotes' });
    }

    await tx.mutate.comment_vote.delete({ id: args.id });
  }),

  // Update a thread vote
  updateThreadVote: defineMutator(updateThreadVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const threadVote = await tx.run(zql.thread_vote.where('id', args.id).one());
      if (!threadVote) {
        throw new Error('Thread vote not found');
      }

      requireOwner(tx, ctx, threadVote.user_id, { action: 'update', resource: 'threads' });
    }

    await tx.mutate.thread_vote.update(args);
  }),

  // Delete a thread vote
  deleteThreadVote: defineMutator(deleteThreadVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const threadVote = await tx.run(zql.thread_vote.where('id', args.id).one());
      if (!threadVote) {
        throw new Error('Thread vote not found');
      }

      requireOwner(tx, ctx, threadVote.user_id, { action: 'delete', resource: 'threads' });
    }

    await tx.mutate.thread_vote.delete({ id: args.id });
  }),

  // Update a thread (vote counts)
  updateThread: defineMutator(updateThreadSchema, async ({ tx, ctx, args }) => {
    await authorizeThreadAuthorOrParentManage(tx, ctx, args.id, 'update');

    await tx.mutate.thread.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  // Update a comment (vote counts)
  updateComment: defineMutator(updateCommentSchema, async ({ tx, ctx, args }) => {
    await authorizeCommentAuthorOrParentManage(tx, ctx, args.id, 'update');

    await tx.mutate.comment.update({
      ...args,
      updated_at: Date.now(),
    });
  }),
};
