import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import {
  denyPublicApiMutation,
  requireAuthenticated,
  requireOwner,
  requireSelf,
} from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';
import { zql } from '../schema';
import {
  createHashtagSchema,
  deleteHashtagSchema,
  createUserHashtagSchema,
  createGroupHashtagSchema,
  createAmendmentHashtagSchema,
  createEventHashtagSchema,
  createBlogHashtagSchema,
  createStatementHashtagSchema,
  deleteJunctionHashtagSchema,
  createLinkSchema,
  deleteLinkSchema,
  createReactionSchema,
  deleteReactionSchema,
  createTimelineEventSchema,
} from './schema';
import { createSubscriberSchema, deleteSubscriberSchema } from '../network/schema';

/** Shared mutators — run on both client and server. Server mutators may override these. */
async function assertCanMutateStatement(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  statementId: string,
  action: 'update' | 'delete'
) {
  if (tx.location === 'client') return;
  const statement = await tx.run(zql.statement.where('id', statementId).one());
  requireOwner(tx, ctx, statement?.user_id, { action, resource: 'statements' });
}

async function assertCanViewSubscriptionTarget(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  args: {
    user_id?: string | null;
    group_id?: string | null;
    amendment_id?: string | null;
    event_id?: string | null;
    blog_id?: string | null;
  }
) {
  if (tx.location === 'client') return;
  requireAuthenticated(tx, ctx, { action: 'create', resource: 'notifications' });

  if (args.user_id) {
    const user = await tx.run(zql.user.where('id', args.user_id).one());
    if (!user) throw new Error('User not found');
    if (
      user.id === ctx.userID ||
      user.visibility === 'public' ||
      user.visibility === 'authenticated'
    ) {
      return;
    }
    requireOwner(tx, ctx, user.id, { action: 'view', resource: '$users' });
    return;
  }

  if (args.group_id) {
    await can(tx, ctx, { action: 'view', resource: 'groups', groupId: args.group_id });
  }
  if (args.amendment_id) {
    await can(tx, ctx, { action: 'view', resource: 'amendments', amendmentId: args.amendment_id });
  }
  if (args.event_id) {
    await can(tx, ctx, { action: 'view', resource: 'events', eventId: args.event_id });
  }
  if (args.blog_id) {
    await can(tx, ctx, { action: 'view', resource: 'blogs', blogId: args.blog_id });
  }
}

export const commonSharedMutators = {
  // Subscribe to an entity
  subscribe: defineMutator(createSubscriberSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    await assertCanViewSubscriptionTarget(tx, ctx, args);
    const now = Date.now();
    await tx.mutate.subscriber.insert({
      ...args,
      subscriber_id: userID,
      created_at: now,
    });
  }),

  // Unsubscribe from an entity
  unsubscribe: defineMutator(deleteSubscriberSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const subscriber = await tx.run(zql.subscriber.where('id', args.id).one());
      requireOwner(tx, ctx, subscriber?.subscriber_id, {
        action: 'delete',
        resource: 'notifications',
      });
    }

    await tx.mutate.subscriber.delete({ id: args.id });
  }),

  // Add a canonical hashtag
  addHashtag: defineMutator(createHashtagSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'comments' });
    const now = Date.now();
    await tx.mutate.hashtag.insert({
      ...args,
      created_at: now,
    });
  }),

  // Delete a canonical hashtag
  deleteHashtag: defineMutator(deleteHashtagSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'delete', resource: 'comments' });
    await tx.mutate.hashtag.delete({ id: args.id });
  }),

  // ── Junction table mutators ────────────────────────────────────────

  linkUserHashtag: defineMutator(createUserHashtagSchema, async ({ tx, ctx, args }) => {
    requireSelf(tx, ctx, args.user_id, { action: 'update', resource: '$users' });
    const now = Date.now();
    await tx.mutate.user_hashtag.insert({ ...args, created_at: now });
  }),

  unlinkUserHashtag: defineMutator(deleteJunctionHashtagSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.user_hashtag.where('id', args.id).one());
      requireSelf(tx, ctx, row?.user_id, { action: 'update', resource: '$users' });
    }

    await tx.mutate.user_hashtag.delete({ id: args.id });
  }),

  linkGroupHashtag: defineMutator(createGroupHashtagSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'update', resource: 'groups', groupId: args.group_id });
    const now = Date.now();
    await tx.mutate.group_hashtag.insert({ ...args, created_at: now });
  }),

  unlinkGroupHashtag: defineMutator(deleteJunctionHashtagSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.group_hashtag.where('id', args.id).one());
      if (row?.group_id) {
        await can(tx, ctx, { action: 'update', resource: 'groups', groupId: row.group_id });
      }
    }

    await tx.mutate.group_hashtag.delete({ id: args.id });
  }),

  linkAmendmentHashtag: defineMutator(createAmendmentHashtagSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, {
      action: 'update',
      resource: 'amendments',
      amendmentId: args.amendment_id,
    });
    const now = Date.now();
    await tx.mutate.amendment_hashtag.insert({ ...args, created_at: now });
  }),

  unlinkAmendmentHashtag: defineMutator(deleteJunctionHashtagSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.amendment_hashtag.where('id', args.id).one());
      if (row?.amendment_id) {
        await can(tx, ctx, {
          action: 'update',
          resource: 'amendments',
          amendmentId: row.amendment_id,
        });
      }
    }

    await tx.mutate.amendment_hashtag.delete({ id: args.id });
  }),

  linkEventHashtag: defineMutator(createEventHashtagSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'update', resource: 'events', eventId: args.event_id });
    const now = Date.now();
    await tx.mutate.event_hashtag.insert({ ...args, created_at: now });
  }),

  unlinkEventHashtag: defineMutator(deleteJunctionHashtagSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.event_hashtag.where('id', args.id).one());
      if (row?.event_id) {
        await can(tx, ctx, { action: 'update', resource: 'events', eventId: row.event_id });
      }
    }

    await tx.mutate.event_hashtag.delete({ id: args.id });
  }),

  linkBlogHashtag: defineMutator(createBlogHashtagSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'update', resource: 'blogs', blogId: args.blog_id });
    const now = Date.now();
    await tx.mutate.blog_hashtag.insert({ ...args, created_at: now });
  }),

  unlinkBlogHashtag: defineMutator(deleteJunctionHashtagSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.blog_hashtag.where('id', args.id).one());
      if (row?.blog_id) {
        await can(tx, ctx, { action: 'update', resource: 'blogs', blogId: row.blog_id });
      }
    }

    await tx.mutate.blog_hashtag.delete({ id: args.id });
  }),

  linkStatementHashtag: defineMutator(createStatementHashtagSchema, async ({ tx, ctx, args }) => {
    await assertCanMutateStatement(tx, ctx, args.statement_id, 'update');
    const now = Date.now();
    await tx.mutate.statement_hashtag.insert({ ...args, created_at: now });
  }),

  unlinkStatementHashtag: defineMutator(deleteJunctionHashtagSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.statement_hashtag.where('id', args.id).one());
      if (row?.statement_id) {
        await assertCanMutateStatement(tx, ctx, row.statement_id, 'update');
      }
    }

    await tx.mutate.statement_hashtag.delete({ id: args.id });
  }),

  // Create a link
  createLink: defineMutator(createLinkSchema, async ({ tx, ctx, args }) => {
    let hasOwnerScope = false;

    if (args.user_id) {
      hasOwnerScope = true;
      requireSelf(tx, ctx, args.user_id, { action: 'update', resource: '$users' });
    }

    if (args.group_id) {
      hasOwnerScope = true;
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupLinks',
        groupId: args.group_id,
      });
    }

    if (args.event_id) {
      hasOwnerScope = true;
      await can(tx, ctx, {
        action: 'update',
        resource: 'events',
        eventId: args.event_id,
      });
    }

    if (!hasOwnerScope && tx.location !== 'client') {
      throw new PermissionError('create', 'groupLinks', 'missing link owner');
    }

    const now = Date.now();
    await tx.mutate.link.insert({
      ...args,
      created_at: now,
    });
  }),

  // Create a reaction
  createReaction: defineMutator(createReactionSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'comments' });
    const now = Date.now();
    await tx.mutate.reaction.insert({
      ...args,
      user_id: userID,
      created_at: now,
    });
  }),

  // NOTE: server-only mutator — should be called from server context only
  createTimelineEvent: defineMutator(createTimelineEventSchema, async ({ tx, args }) => {
    denyPublicApiMutation(tx, {
      action: 'create',
      resource: 'notifications',
      scope: 'timeline-event',
    });

    const now = Date.now();
    await tx.mutate.timeline_event.insert({
      ...args,
      created_at: now,
    });
  }),

  // Delete a link
  deleteLink: defineMutator(deleteLinkSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const existingLink = await tx.run(zql.link.where('id', args.id).one());
      if (!existingLink) {
        throw new Error('Link not found');
      }

      if (existingLink.group_id) {
        await can(tx, ctx, {
          action: 'manage',
          resource: 'groupLinks',
          groupId: existingLink.group_id,
        });
      }

      if (existingLink.user_id) {
        requireSelf(tx, ctx, existingLink.user_id, { action: 'update', resource: '$users' });
      }

      if (existingLink.event_id) {
        await can(tx, ctx, {
          action: 'update',
          resource: 'events',
          eventId: existingLink.event_id,
        });
      }

      if (!existingLink.group_id && !existingLink.user_id && !existingLink.event_id) {
        throw new PermissionError('delete', 'groupLinks', `link:${args.id}`);
      }
    }

    await tx.mutate.link.delete({ id: args.id });
  }),

  // Delete a reaction
  deleteReaction: defineMutator(deleteReactionSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const reaction = await tx.run(zql.reaction.where('id', args.id).one());
      requireOwner(tx, ctx, reaction?.user_id, { action: 'delete', resource: 'comments' });
    }

    await tx.mutate.reaction.delete({ id: args.id });
  }),
};
