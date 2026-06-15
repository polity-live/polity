import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { userName, recomputeBlogCounters } from '../server-helpers';
import {
  createBlogSchema,
  createBlogBloggerSchema,
  updateBlogBloggerSchema,
  deleteBlogBloggerSchema,
  updateBlogSchema,
  deleteBlogSchema,
} from './schema';
import {
  createBlogSupportVoteSchema,
  updateBlogSupportVoteSchema,
  deleteBlogSupportVoteSchema,
} from '../votes/schema';
import { DEFAULT_BLOG_ROLES } from '../rbac/constants';

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
const APPROVED_BLOGGER_STATUSES = new Set(['member', 'writer']);

async function loadBlogNotificationContext(
  tx: Parameters<typeof mutators.blogs.update.fn>[0]['tx'],
  blogId: string
) {
  const [blogRow, ownerRelation] = await Promise.all([
    tx.run(zql.blog.where('id', blogId).one()),
    tx.run(zql.blog_blogger.where('blog_id', blogId).where('status', 'owner').one()),
  ]);

  return {
    blogTitle: blogRow?.title ?? 'Blog',
    groupId: blogRow?.group_id ?? undefined,
    ownerId: ownerRelation?.user_id ?? undefined,
  };
}

export const blogServerMutators = {
  create: defineMutator(createBlogSchema, async ({ tx, ctx, args }) => {
    await mutators.blogs.create.fn({ tx, ctx, args });

    const now = Date.now();
    let ownerRoleId: string | null = null;
    const totalRoles = DEFAULT_BLOG_ROLES.length;

    for (let index = 0; index < totalRoles; index++) {
      const roleDef = DEFAULT_BLOG_ROLES[index];
      const roleId = crypto.randomUUID();

      if (roleDef.name === 'Owner') {
        ownerRoleId = roleId;
      }

      await tx.mutate.role.insert({
        id: roleId,
        name: roleDef.name,
        description: roleDef.description,
        scope: 'blog',
        group_id: null,
        event_id: null,
        amendment_id: null,
        blog_id: args.id,
        assignment_mode: 'assigned',
        visibility: 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: false,
        default_invite_role: false,
        assignee_kind: 'member',
        sort_order: totalRoles - 1 - index,
        created_at: now,
      });

      for (const permission of roleDef.permissions) {
        await tx.mutate.action_right.insert({
          id: crypto.randomUUID(),
          resource: permission.resource,
          action: permission.action,
          role_id: roleId,
          group_id: null,
          event_id: null,
          amendment_id: null,
          blog_id: args.id,
          created_at: now,
        });
      }
    }

    await tx.mutate.blog_blogger.insert({
      id: crypto.randomUUID(),
      blog_id: args.id,
      user_id: ctx.userID,
      role_id: ownerRoleId,
      status: 'owner',
      visibility: args.visibility ?? 'public',
      created_at: now,
    });
  }),

  createEntry: defineMutator(createBlogBloggerSchema, async ({ tx, ctx, args }) => {
    await mutators.blogs.createEntry.fn({ tx, ctx, args });

    const blogContext = await loadBlogNotificationContext(tx, args.blog_id);

    if (args.status === 'invited') {
      fireNotification('notifyBloggerInvited', {
        senderId: ctx.userID,
        recipientUserId: args.user_id,
        blogId: args.blog_id,
        blogTitle: blogContext.blogTitle,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
      return;
    }

    if (args.status === 'requested') {
      const senderName = await userName(tx, ctx.userID);
      fireNotification('notifyBlogWriterRequest', {
        senderId: ctx.userID,
        senderName,
        blogId: args.blog_id,
        blogTitle: blogContext.blogTitle,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  updateEntry: defineMutator(updateBlogBloggerSchema, async ({ tx, ctx, args }) => {
    const oldEntry = await tx.run(zql.blog_blogger.where('id', args.id).one());

    await mutators.blogs.updateEntry.fn({ tx, ctx, args });

    if (!oldEntry) return;

    const bId = oldEntry.blog_id;
    const entryUserId = oldEntry.user_id;
    const oldStatus = oldEntry.status;
    const newStatus = args.status ?? oldStatus;
    const isSelf = ctx.userID === entryUserId;

    const blogContext = await loadBlogNotificationContext(tx, bId);

    if (
      newStatus !== oldStatus &&
      APPROVED_BLOGGER_STATUSES.has(newStatus ?? '') &&
      (oldStatus === 'invited' || oldStatus === 'requested')
    ) {
      if (isSelf) {
        const uName = await userName(tx, ctx.userID);
        fireNotification('notifyBlogInvitationAccepted', {
          senderId: ctx.userID,
          senderName: uName,
          blogId: bId,
          blogTitle: blogContext.blogTitle,
          groupId: blogContext.groupId,
          ownerId: blogContext.ownerId,
        });
      } else {
        fireNotification('notifyBlogWriterApproved', {
          senderId: ctx.userID,
          recipientUserId: entryUserId,
          blogId: bId,
          blogTitle: blogContext.blogTitle,
          groupId: blogContext.groupId,
          ownerId: blogContext.ownerId,
        });
      }
    }

    if (args.role_id !== undefined && args.role_id !== oldEntry.role_id) {
      const newRole = args.role_id ? await tx.run(zql.role.where('id', args.role_id).one()) : null;

      fireNotification('notifyBloggerRoleChanged', {
        senderId: ctx.userID,
        recipientUserId: entryUserId,
        blogId: bId,
        blogTitle: blogContext.blogTitle,
        newRole: newRole?.name ?? 'Writer',
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  deleteEntry: defineMutator(deleteBlogBloggerSchema, async ({ tx, ctx, args }) => {
    const entry = await tx.run(zql.blog_blogger.where('id', args.id).one());

    await mutators.blogs.deleteEntry.fn({ tx, ctx, args });

    if (!entry) return;

    const bId = entry.blog_id;
    const entryUserId = entry.user_id;
    const status = entry.status;
    const isSelf = ctx.userID === entryUserId;

    const [uName, blogContext] = await Promise.all([
      userName(tx, entryUserId),
      loadBlogNotificationContext(tx, bId),
    ]);

    if (isSelf) {
      if (status === 'requested') {
        fireNotification('notifyBlogRequestWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          blogId: bId,
          blogTitle: blogContext.blogTitle,
          groupId: blogContext.groupId,
          ownerId: blogContext.ownerId,
        });
      } else if (status === 'invited') {
        fireNotification('notifyBlogInvitationDeclined', {
          senderId: ctx.userID,
          senderName: uName,
          blogId: bId,
          blogTitle: blogContext.blogTitle,
          groupId: blogContext.groupId,
          ownerId: blogContext.ownerId,
        });
      } else {
        fireNotification('notifyBlogWriterLeft', {
          senderId: ctx.userID,
          senderName: uName,
          blogId: bId,
          blogTitle: blogContext.blogTitle,
          groupId: blogContext.groupId,
          ownerId: blogContext.ownerId,
        });
      }
    } else {
      fireNotification('notifyBlogWriterRemoved', {
        senderId: ctx.userID,
        recipientUserId: entryUserId,
        blogId: bId,
        blogTitle: blogContext.blogTitle,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  update: defineMutator(updateBlogSchema, async ({ tx, ctx, args }) => {
    const previousBlog = await tx.run(zql.blog.where('id', args.id).one());

    await mutators.blogs.update.fn({ tx, ctx, args });

    if (!previousBlog) return;

    const hasProfileChanges =
      (args.title !== undefined && args.title !== previousBlog.title) ||
      (args.description !== undefined && args.description !== previousBlog.description) ||
      (args.date !== undefined && args.date !== previousBlog.date) ||
      (args.image_url !== undefined && args.image_url !== previousBlog.image_url) ||
      (args.visibility !== undefined && args.visibility !== previousBlog.visibility);

    if (!hasProfileChanges) {
      return;
    }

    const blogContext = await loadBlogNotificationContext(tx, args.id);
    const notificationArgs = {
      senderId: ctx.userID,
      blogId: args.id,
      blogTitle: args.title ?? blogContext.blogTitle,
      groupId: blogContext.groupId,
      ownerId: blogContext.ownerId,
    };

    if (previousBlog.visibility !== 'public' && args.visibility === 'public') {
      fireNotification('notifyBlogPublished', notificationArgs);
      return;
    }

    fireNotification('notifyBlogUpdated', notificationArgs);
  }),

  delete: defineMutator(deleteBlogSchema, async ({ tx, ctx, args }) => {
    const blogContext = await loadBlogNotificationContext(tx, args.id);

    await mutators.blogs.delete.fn({ tx, ctx, args });

    fireNotification('notifyBlogDeleted', {
      senderId: ctx.userID,
      blogId: args.id,
      blogTitle: blogContext.blogTitle,
    });
  }),

  createSupportVote: defineMutator(createBlogSupportVoteSchema, async ({ tx, ctx, args }) => {
    await mutators.blogs.createSupportVote.fn({ tx, ctx, args });
    await recomputeBlogCounters(tx, args.blog_id);

    const [senderName, blogContext] = await Promise.all([
      userName(tx, ctx.userID),
      loadBlogNotificationContext(tx, args.blog_id),
    ]);

    fireNotification('notifyBlogVoted', {
      senderId: ctx.userID,
      senderName,
      recipientUserId: blogContext.ownerId,
      blogId: args.blog_id,
      blogTitle: blogContext.blogTitle,
      voteType: (args.vote ?? 1) > 0 ? 'upvote' : 'downvote',
      groupId: blogContext.groupId,
      ownerId: blogContext.ownerId,
    });
  }),

  updateSupportVote: defineMutator(updateBlogSupportVoteSchema, async ({ tx, ctx, args }) => {
    const vote = await tx.run(zql.blog_support_vote.where('id', args.id).one());
    await mutators.blogs.updateSupportVote.fn({ tx, ctx, args });
    if (vote?.blog_id) {
      await recomputeBlogCounters(tx, vote.blog_id);

      if (args.vote !== undefined && args.vote !== vote.vote) {
        const [senderName, blogContext] = await Promise.all([
          userName(tx, ctx.userID),
          loadBlogNotificationContext(tx, vote.blog_id),
        ]);

        fireNotification('notifyBlogVoted', {
          senderId: ctx.userID,
          senderName,
          recipientUserId: blogContext.ownerId,
          blogId: vote.blog_id,
          blogTitle: blogContext.blogTitle,
          voteType: (args.vote ?? 1) > 0 ? 'upvote' : 'downvote',
          groupId: blogContext.groupId,
          ownerId: blogContext.ownerId,
        });
      }
    }
  }),

  deleteSupportVote: defineMutator(deleteBlogSupportVoteSchema, async ({ tx, ctx, args }) => {
    const vote = await tx.run(zql.blog_support_vote.where('id', args.id).one());
    await mutators.blogs.deleteSupportVote.fn({ tx, ctx, args });
    if (vote?.blog_id) {
      await recomputeBlogCounters(tx, vote.blog_id);
    }
  }),
};
