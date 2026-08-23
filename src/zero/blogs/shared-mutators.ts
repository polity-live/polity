import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import {
  canReadVisibility,
  denyPublicApiMutation,
  requireAuthenticated,
  requireOwner,
} from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';
import { zql } from '../schema';
import {
  createBlogSchema,
  createBlogFullMutatorSchema,
  updateBlogSchema,
  deleteBlogSchema,
  createBlogBloggerSchema,
  updateBlogBloggerSchema,
  deleteBlogBloggerSchema,
} from './schema';
import {
  createBlogSupportVoteSchema,
  updateBlogSupportVoteSchema,
  deleteBlogSupportVoteSchema,
} from '../votes/schema';
import { roleCreateSchema, actionRightCreateSchema } from '../groups/schema';
import { DEFAULT_BLOG_ROLES } from '../rbac/constants';
import { creatorActionRightId, creatorRbacId, creatorRoleId } from '../rbac/creator-bootstrap';

/** Shared mutators — run on both client and server. Server mutators may override these. */
const ACTIVE_BLOGGER_STATUSES = new Set(['owner', 'admin', 'member', 'writer']);

async function bootstrapBlogCreatorRbac(
  tx: Parameters<typeof can>[0],
  args: { blogId: string; creatorId: string; visibility: string; createdAt: number }
) {
  const totalRoles = DEFAULT_BLOG_ROLES.length;
  let ownerRoleId: string | null = null;

  for (let index = 0; index < totalRoles; index++) {
    const roleDef = DEFAULT_BLOG_ROLES[index];
    const roleId = await creatorRoleId('blog', args.blogId, roleDef.name);
    if (roleDef.name === 'Owner') ownerRoleId = roleId;

    await tx.mutate.role.insert({
      id: roleId,
      name: roleDef.name,
      description: roleDef.description,
      scope: 'blog',
      group_id: null,
      event_id: null,
      amendment_id: null,
      blog_id: args.blogId,
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
      created_at: args.createdAt,
    });

    for (const permission of roleDef.permissions) {
      await tx.mutate.action_right.insert({
        id: await creatorActionRightId(
          'blog',
          args.blogId,
          roleDef.name,
          permission.resource,
          permission.action
        ),
        resource: permission.resource,
        action: permission.action,
        role_id: roleId,
        group_id: null,
        event_id: null,
        amendment_id: null,
        blog_id: args.blogId,
        created_at: args.createdAt,
      });
    }
  }

  if (!ownerRoleId) throw new Error('Default Owner role is missing');

  await tx.mutate.blog_blogger.insert({
    id: await creatorRbacId('blog', args.blogId, 'creator-blogger', args.creatorId),
    blog_id: args.blogId,
    user_id: args.creatorId,
    role_id: ownerRoleId,
    status: 'owner',
    visibility: args.visibility,
    created_at: args.createdAt,
  });
}

export async function assertCanViewBlog(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  blogId: string
) {
  if (tx.location === 'client') return;

  const blog = await tx.run(zql.blog.where('id', blogId).one());
  if (!blog) {
    throw new Error('Blog not found');
  }

  if (canReadVisibility(blog.visibility, ctx, false)) return;

  const relation = await tx.run(
    zql.blog_blogger
      .where('blog_id', blogId)
      .where('user_id', ctx.userID)
      .where('status', 'IN', [...ACTIVE_BLOGGER_STATUSES])
      .one()
  );
  if (relation) return;

  if (blog.group_id) {
    const [group, membership, guestAccess] = await Promise.all([
      tx.run(zql.group.where('id', blog.group_id).where('owner_id', ctx.userID).one()),
      tx.run(
        zql.group_membership
          .where('group_id', blog.group_id)
          .where('user_id', ctx.userID)
          .where('status', 'IN', ['active', 'member', 'admin'])
          .one()
      ),
      tx.run(
        zql.group_guest_access
          .where('group_id', blog.group_id)
          .where('user_id', ctx.userID)
          .where('status', 'active')
          .one()
      ),
    ]);
    if (group || membership || guestAccess) return;
  }

  throw new PermissionError('view', 'blogs', `blog:${blogId}`);
}

async function assertCanManageBlog(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  blogId: string,
  action: 'manage' | 'update' | 'delete' = 'manage',
  resource: 'blogs' | 'blogBloggers' = 'blogs'
) {
  if (tx.location === 'client') return;
  await can(tx, ctx, { action, resource, blogId });
}

export const blogSharedMutators = {
  // Create a blog
  create: defineMutator(createBlogSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'blogs' });
    if (args.group_id) {
      await can(tx, ctx, { action: 'create', resource: 'blogs', groupId: args.group_id });
    }

    const now = Date.now();
    await tx.mutate.blog.insert({
      ...args,
      subscriber_count: 0,
      supporter_count: 0,
      like_count: 0,
      comment_count: 0,
      upvotes: 0,
      downvotes: 0,
      updated_at: now,
      created_at: now,
    });
    await bootstrapBlogCreatorRbac(tx, {
      blogId: args.id,
      creatorId: ctx.userID,
      visibility: args.visibility ?? 'public',
      createdAt: now,
    });
  }),

  createFull: defineMutator(createBlogFullMutatorSchema, async ({ tx, ctx, args }) => {
    await blogSharedMutators.create.fn({ tx, ctx, args: args.blog });
  }),

  // Update a blog
  update: defineMutator(updateBlogSchema, async ({ tx, ctx, args }) => {
    await assertCanManageBlog(tx, ctx, args.id, 'update', 'blogs');
    await tx.mutate.blog.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  // Delete a blog
  delete: defineMutator(deleteBlogSchema, async ({ tx, ctx, args }) => {
    await assertCanManageBlog(tx, ctx, args.id, 'delete', 'blogs');
    await tx.mutate.blog.delete({ id: args.id });
  }),

  // Create a blog_blogger entry
  createEntry: defineMutator(createBlogBloggerSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'blogBloggers' });
    const isSelfRequest = args.user_id === ctx.userID && args.status === 'requested';
    if (isSelfRequest) {
      await assertCanViewBlog(tx, ctx, args.blog_id);
    } else {
      await assertCanManageBlog(tx, ctx, args.blog_id, 'manage', 'blogBloggers');
    }

    const now = Date.now();
    await tx.mutate.blog_blogger.insert({
      ...args,
      created_at: now,
    });
  }),

  // Update a blog_blogger entry
  updateEntry: defineMutator(updateBlogBloggerSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const entry = await tx.run(zql.blog_blogger.where('id', args.id).one());
      if (!entry) throw new Error('Blog relation not found');
      const isSelfStatusUpdate =
        entry.user_id === ctx.userID && args.role_id === undefined && args.visibility === undefined;
      if (!isSelfStatusUpdate) {
        await assertCanManageBlog(tx, ctx, entry.blog_id, 'manage', 'blogBloggers');
      }
    }

    await tx.mutate.blog_blogger.update(args);
  }),

  // Delete a blog_blogger entry
  deleteEntry: defineMutator(deleteBlogBloggerSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const entry = await tx.run(zql.blog_blogger.where('id', args.id).one());
      if (!entry) throw new Error('Blog relation not found');
      if (entry.user_id !== ctx.userID) {
        await assertCanManageBlog(tx, ctx, entry.blog_id, 'manage', 'blogBloggers');
      }
    }

    await tx.mutate.blog_blogger.delete({ id: args.id });
  }),

  // Blog Support Vote mutators
  createSupportVote: defineMutator(createBlogSupportVoteSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'vote', resource: 'blogs' });
    await assertCanViewBlog(tx, ctx, args.blog_id);
    const now = Date.now();
    await tx.mutate.blog_support_vote.insert({
      ...args,
      user_id: userID,
      created_at: now,
    });
  }),

  updateSupportVote: defineMutator(updateBlogSupportVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const vote = await tx.run(zql.blog_support_vote.where('id', args.id).one());
      requireOwner(tx, ctx, vote?.user_id, { action: 'update', resource: 'blogs' });
    }

    await tx.mutate.blog_support_vote.update(args);
  }),

  deleteSupportVote: defineMutator(deleteBlogSupportVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const vote = await tx.run(zql.blog_support_vote.where('id', args.id).one());
      requireOwner(tx, ctx, vote?.user_id, { action: 'delete', resource: 'blogs' });
    }

    await tx.mutate.blog_support_vote.delete({ id: args.id });
  }),

  // Blog-scoped role creation (no group permission check needed)
  createRole: defineMutator(roleCreateSchema, async ({ tx, ctx, args }) => {
    if (args.blog_id) {
      await assertCanManageBlog(tx, ctx, args.blog_id, 'manage', 'blogBloggers');
    } else {
      denyPublicApiMutation(tx, { action: 'create', resource: 'roles', scope: 'blog required' });
    }

    const now = Date.now();
    await tx.mutate.role.insert({
      ...args,
      assignee_kind: args.assignee_kind ?? 'member',
      assignment_mode: args.assignment_mode ?? 'assigned',
      visibility: args.visibility ?? 'public',
      term_start_date: args.term_start_date ?? null,
      is_recurring: args.is_recurring ?? false,
      recurrence_pattern: args.recurrence_pattern ?? null,
      recurrence_rule: args.recurrence_rule ?? null,
      recurrence_interval: args.recurrence_interval ?? null,
      recurrence_days: args.recurrence_days ?? null,
      recurrence_end_date: args.recurrence_end_date ?? null,
      scheduled_revote_date: args.scheduled_revote_date ?? null,
      default_request_role: args.default_request_role ?? false,
      default_invite_role: args.default_invite_role ?? false,
      sort_order: args.sort_order ?? 0,
      created_at: now,
    });
  }),

  // Blog-scoped action right assignment (no group permission check needed)
  assignActionRight: defineMutator(actionRightCreateSchema, async ({ tx, ctx, args }) => {
    if (args.blog_id) {
      await assertCanManageBlog(tx, ctx, args.blog_id, 'manage', 'blogBloggers');
    } else {
      denyPublicApiMutation(tx, {
        action: 'create',
        resource: 'actionRights',
        scope: 'blog required',
      });
    }

    const now = Date.now();
    await tx.mutate.action_right.insert({ ...args, created_at: now });
  }),
};
