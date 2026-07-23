import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import {
  amendmentTitle,
  blogTitle,
  groupName,
  recomputeAmendmentCounters,
  recomputeBlogCounters,
  userName,
} from '../server-helpers';
import {
  deleteDocumentSchema,
  createDocumentSchema,
  createDocumentCollaboratorSchema,
  createDocumentVersionSchema,
} from './schema';
import { createCommentSchema } from '../discussions/schema';
import {
  createCommentVoteSchema,
  createThreadVoteSchema,
  deleteCommentVoteSchema,
  deleteThreadVoteSchema,
  updateCommentVoteSchema,
  updateThreadVoteSchema,
} from '../votes/schema';
import { collectTodoCommentRecipientIds } from '../todos/comment-notifications';

async function recomputeThreadVoteCounters(tx: Parameters<typeof groupName>[0], threadId: string) {
  const votes = await tx.run(zql.thread_vote.where('thread_id', threadId));
  await tx.mutate.thread.update({
    id: threadId,
    upvotes: votes.filter(vote => vote.vote === 1).length,
    downvotes: votes.filter(vote => vote.vote === -1).length,
    updated_at: Date.now(),
  });
}

async function recomputeCommentVoteCounters(
  tx: Parameters<typeof groupName>[0],
  commentId: string
) {
  const votes = await tx.run(zql.comment_vote.where('comment_id', commentId));
  await tx.mutate.comment.update({
    id: commentId,
    upvotes: votes.filter(vote => vote.vote === 1).length,
    downvotes: votes.filter(vote => vote.vote === -1).length,
    updated_at: Date.now(),
  });
}

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const documentServerMutators = {
  create: defineMutator(createDocumentSchema, async ({ tx, ctx, args }) => {
    await mutators.documents.create.fn({ tx, ctx, args });

    // Increment group document_count
    if (args.amendment_id) {
      const amd = await tx.run(zql.amendment.where('id', args.amendment_id).one());
      if (amd?.group_id) {
        const [grp, gName] = await Promise.all([
          tx.run(zql.group.where('id', amd.group_id).one()),
          groupName(tx, amd.group_id),
        ]);
        if (grp) {
          await tx.mutate.group.update({
            id: amd.group_id,
            document_count: (grp.document_count ?? 0) + 1,
          });
        }

        fireNotification('notifyDocumentCreated', {
          senderId: ctx.userID,
          groupId: amd.group_id,
          groupName: gName,
          documentTitle: amd.title ?? 'Document',
        });
      }
    }
  }),

  delete: defineMutator(deleteDocumentSchema, async ({ tx, ctx, args }) => {
    const doc = await tx.run(zql.document.where('id', args.id).one());

    await mutators.documents.delete.fn({ tx, ctx, args });

    if (doc?.amendment_id) {
      const amd = await tx.run(zql.amendment.where('id', doc.amendment_id).one());
      if (amd?.group_id) {
        // Decrement group document_count
        const grp = await tx.run(zql.group.where('id', amd.group_id).one());
        if (grp) {
          await tx.mutate.group.update({
            id: amd.group_id,
            document_count: Math.max(0, (grp.document_count ?? 0) - 1),
          });
        }

        const gName = await groupName(tx, amd.group_id);
        fireNotification('notifyDocumentDeleted', {
          senderId: ctx.userID,
          groupId: amd.group_id,
          groupName: gName,
          documentTitle: amd.title ?? 'Document',
        });
      }
    }
  }),

  createVersion: defineMutator(createDocumentVersionSchema, async ({ tx, ctx, args }) => {
    await mutators.documents.createVersion.fn({ tx, ctx, args });
    const document = await tx.run(zql.document.where('id', args.document_id).one());
    const amendmentId = args.amendment_id ?? document?.amendment_id;
    if (!amendmentId) return;

    await fireNotification('notifyVersionCreated', {
      senderId: ctx.userID,
      amendmentId,
      amendmentTitle: await amendmentTitle(tx, amendmentId),
      version: `v.${args.version_number ?? 1}`,
    });
  }),

  addCollaborator: defineMutator(createDocumentCollaboratorSchema, async ({ tx, ctx, args }) => {
    await mutators.documents.addCollaborator.fn({ tx, ctx, args });
    if (args.user_id === ctx.userID) return;

    const document = await tx.run(zql.document.where('id', args.document_id).one());
    const documentTitle = document?.amendment_id
      ? await amendmentTitle(tx, document.amendment_id)
      : 'Document';
    await fireNotification('notifyDocumentCollaboratorInvited', {
      senderId: ctx.userID,
      recipientUserId: args.user_id,
      documentId: args.document_id,
      documentTitle,
    });
  }),

  addComment: defineMutator(createCommentSchema, async ({ tx, ctx, args }) => {
    await mutators.documents.addComment.fn({ tx, ctx, args });

    if (args.thread_id) {
      const thread = await tx.run(zql.thread.where('id', args.thread_id).one());
      if (thread?.amendment_id) {
        const amd = await tx.run(zql.amendment.where('id', thread.amendment_id).one());
        if (amd) {
          await tx.mutate.amendment.update({
            id: thread.amendment_id,
            comment_count: (amd.comment_count ?? 0) + 1,
          });
        }
      }

      if (thread?.blog_id) {
        await recomputeBlogCounters(tx, thread.blog_id);

        const [bTitle, senderName, blogRow, ownerRelation] = await Promise.all([
          blogTitle(tx, thread.blog_id),
          userName(tx, ctx.userID),
          tx.run(zql.blog.where('id', thread.blog_id).one()),
          tx.run(zql.blog_blogger.where('blog_id', thread.blog_id).where('status', 'owner').one()),
        ]);

        fireNotification('notifyBlogCommentAdded', {
          senderId: ctx.userID,
          senderName,
          blogId: thread.blog_id,
          blogTitle: bTitle,
          groupId: blogRow?.group_id ?? undefined,
          ownerId: ownerRelation?.user_id ?? undefined,
        });
      }

      if (thread?.statement_id) {
        const statement = await tx.run(zql.statement.where('id', thread.statement_id).one());
        if (statement) {
          await tx.mutate.statement.update({
            id: thread.statement_id,
            comment_count: (statement.comment_count ?? 0) + 1,
            updated_at: Date.now(),
          });
        }
      }

      if (thread?.amendment_id) {
        await recomputeAmendmentCounters(tx, thread.amendment_id);

        const [aTitle, senderName] = await Promise.all([
          amendmentTitle(tx, thread.amendment_id),
          userName(tx, ctx.userID),
        ]);

        fireNotification('notifyAmendmentCommentAdded', {
          senderId: ctx.userID,
          senderName,
          amendmentId: thread.amendment_id,
          amendmentTitle: aTitle,
        });
      }

      if (thread?.todo_id) {
        const [todo, assignments, senderName] = await Promise.all([
          tx.run(zql.todo.where('id', thread.todo_id).one()),
          tx.run(zql.todo_assignment.where('todo_id', thread.todo_id)),
          userName(tx, ctx.userID),
        ]);

        if (todo) {
          const recipientIds = collectTodoCommentRecipientIds(
            todo.creator_id,
            assignments.map(assignment => assignment.user_id),
            ctx.userID
          );

          await Promise.all(
            recipientIds.map(recipientUserId =>
              fireNotification('notifyTodoCommentAdded', {
                senderId: ctx.userID,
                senderName,
                recipientUserId,
                todoId: todo.id,
                todoTitle: todo.title ?? 'Todo',
              })
            )
          );
        }
      }
    }
  }),

  voteThread: defineMutator(createThreadVoteSchema, async ({ tx, ctx, args }) => {
    await mutators.documents.voteThread.fn({ tx, ctx, args });
    await recomputeThreadVoteCounters(tx, args.thread_id);
  }),

  updateThreadVote: defineMutator(updateThreadVoteSchema, async ({ tx, ctx, args }) => {
    const vote = await tx.run(zql.thread_vote.where('id', args.id).one());
    await mutators.documents.updateThreadVote.fn({ tx, ctx, args });
    if (vote) await recomputeThreadVoteCounters(tx, vote.thread_id);
  }),

  deleteThreadVote: defineMutator(deleteThreadVoteSchema, async ({ tx, ctx, args }) => {
    const vote = await tx.run(zql.thread_vote.where('id', args.id).one());
    await mutators.documents.deleteThreadVote.fn({ tx, ctx, args });
    if (vote) await recomputeThreadVoteCounters(tx, vote.thread_id);
  }),

  voteComment: defineMutator(createCommentVoteSchema, async ({ tx, ctx, args }) => {
    await mutators.documents.voteComment.fn({ tx, ctx, args });
    await recomputeCommentVoteCounters(tx, args.comment_id);
  }),

  updateCommentVote: defineMutator(updateCommentVoteSchema, async ({ tx, ctx, args }) => {
    const vote = await tx.run(zql.comment_vote.where('id', args.id).one());
    await mutators.documents.updateCommentVote.fn({ tx, ctx, args });
    if (vote) await recomputeCommentVoteCounters(tx, vote.comment_id);
  }),

  deleteCommentVote: defineMutator(deleteCommentVoteSchema, async ({ tx, ctx, args }) => {
    const vote = await tx.run(zql.comment_vote.where('id', args.id).one());
    await mutators.documents.deleteCommentVote.fn({ tx, ctx, args });
    if (vote) await recomputeCommentVoteCounters(tx, vote.comment_id);
  }),
};
