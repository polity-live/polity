import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { applyBlogManagerQueryAccess, applyBlogQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

const blogStartSchema = z.object({ created_at: z.number(), id: z.string() }).nullable();

function applyBlogAccess<T>(q: T, userID: string | undefined): T {
  return applyBlogQueryAccess(q, userID);
}

function applyBlogManagerAccess<T>(q: T, userID: string | undefined): T {
  return applyBlogManagerQueryAccess(q, userID);
}

function applyBlogSubscriberPrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('subscriber_id', userID),
      exists('blog', (blog: any) => applyBlogManagerAccess(blog, userID))
    )
  ) as T;
}

function applyBlogUserPrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('blog', (blog: any) => applyBlogManagerAccess(blog, userID))
    )
  ) as T;
}

function applyBlogCommentVotePrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('comment', (comment: any) =>
        comment.whereExists('thread', (thread: any) =>
          thread.whereExists('blog', (blog: any) => applyBlogManagerAccess(blog, userID))
        )
      )
    )
  ) as T;
}

export const blogQueries = {
  pageByGroup: defineQuery(
    z.object({
      groupId: z.string(),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: blogStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { groupId, query, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = applyBlogAccess(zql.blog.where('group_id', groupId), userID).related(
        'blog_hashtags',
        (hashtag: any) => hashtag.related('hashtag')
      );
      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        q = q.where(({ or, cmp }: any) =>
          or(
            cmp('title', 'ILIKE', `%${normalizedQuery}%`),
            cmp('description', 'ILIKE', `%${normalizedQuery}%`)
          )
        );
      }
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  pageByUser: defineQuery(
    z.object({
      userId: z.string(),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: blogStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { userId, query, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = applyBlogAccess(zql.blog, userID)
        .whereExists('bloggers', (blogger: any) => blogger.where('user_id', userId))
        .related('bloggers', (blogger: any) => blogger.related('user'))
        .related('blog_hashtags', (hashtag: any) => hashtag.related('hashtag'));
      const term = query.trim();
      if (term)
        q = q.where(({ or, cmp }: any) =>
          or(cmp('title', 'ILIKE', `%${term}%`), cmp('description', 'ILIKE', `%${term}%`))
        );
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  // Blogs by the current user (as blogger)
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.blog_blogger
      .where('user_id', userID)
      .whereExists('blog', blog => applyBlogAccess(blog, userID))
      .related('blog')
      .related('role', role => role.related('blog_action_rights'))
      .orderBy('created_at', 'desc')
  ),

  // Blogs belonging to a group
  byGroup: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyBlogAccess(zql.blog.where('group_id', group_id), userID).orderBy('created_at', 'desc')
  ),

  // Single blog by ID
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyBlogAccess(zql.blog.where('id', id), userID).one()
  ),

  // Blog with bloggers + user relations
  byIdWithBloggers: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyBlogAccess(zql.blog.where('id', id), userID)
      .related('bloggers', q => q.related('user'))
      .one()
  ),

  // Blog with management data (bloggers+roles+action_rights)
  byIdWithManagement: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyBlogManagerAccess(zql.blog.where('id', id), userID)
        .related('bloggers', q => q.related('user').related('role'))
        .related('roles', q => q.where('scope', 'blog').related('action_rights'))
        .one()
  ),

  // Blog with full detail relations (for BlogDetail)
  byIdWithDetails: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyBlogAccess(zql.blog.where('id', id), userID)
      .related('bloggers', q => q.related('user'))
      .related('blog_hashtags', q => q.related('hashtag'))
      .related('subscribers', q => applyBlogSubscriberPrivateAccess(q, userID))
      .related('support_votes', q => applyBlogUserPrivateAccess(q, userID).related('user'))
      .one()
  ),

  // Blog with hashtags
  byIdWithHashtags: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyBlogAccess(zql.blog.where('id', id), userID)
      .related('blog_hashtags', q => q.related('hashtag'))
      .one()
  ),

  // Blog for editor (with bloggers, roles, action_rights)
  byIdForEditor: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyBlogManagerAccess(zql.blog.where('id', id), userID)
      .related('bloggers', q =>
        q.related('user').related('role', q2 => q2.related('action_rights'))
      )
      .one()
  ),

  // All blog_blogger entries for a blog
  entries: defineQuery(
    z.object({ blog_id: z.string() }),
    ({ args: { blog_id }, ctx: { userID } }) =>
      zql.blog_blogger
        .where('blog_id', blog_id)
        .whereExists('blog', blog => applyBlogAccess(blog, userID))
        .orderBy('created_at', 'desc')
  ),

  bloggerPage: defineQuery(
    z.object({
      blogId: z.string(),
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      roleId: z.string().optional(),
      roleIds: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({
      args: { blogId, status, statuses, roleId, roleIds, query, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = zql.blog_blogger
        .where('blog_id', blogId)
        .whereExists('blog', (blog: any) => applyBlogAccess(blog, userID));
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      if (roleId) q = q.where('role_id', roleId);
      if ((roleIds?.length ?? 0) > 0) q = q.where('role_id', 'IN', roleIds);
      const term = query.trim();
      if (term) {
        q = q.whereExists('user', (user: any) =>
          user.where(({ or, cmp }: any) =>
            or(
              cmp('first_name', 'ILIKE', `%${term}%`),
              cmp('last_name', 'ILIKE', `%${term}%`),
              cmp('handle', 'ILIKE', `%${term}%`)
            )
          )
        );
      }
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.related('user').related('role').limit(limit);
    }
  ),

  bloggerPageById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    zql.blog_blogger
      .where('id', id)
      .whereExists('blog', blog => applyBlogAccess(blog, userID))
      .related('user')
      .related('role')
      .one()
  ),

  bloggerMembershipPageByUser: defineQuery(
    z.object({
      userId: z.string(),
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: blogStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { userId, status, statuses, query, limit, start, dir }, ctx: { userID } }) => {
      let q: any = zql.blog_blogger.where('user_id', userId).where('user_id', userID);
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      const term = query.trim();
      if (term) q = q.whereExists('blog', (blog: any) => blog.where('title', 'ILIKE', `%${term}%`));
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('blog', (blog: any) =>
          applyBlogAccess(blog, userID).related('blog_hashtags', (link: any) =>
            link.related('hashtag')
          )
        )
        .related('user')
        .related('role')
        .limit(limit);
    }
  ),

  // Single blog_blogger entry by ID
  entryById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    zql.blog_blogger
      .where('id', id)
      .whereExists('blog', blog => applyBlogAccess(blog, userID))
      .one()
  ),

  // Document versions for a blog
  versionsByBlogId: defineQuery(
    z.object({ blog_id: z.string() }),
    ({ args: { blog_id }, ctx: { userID } }) =>
      zql.document_version
        .where('blog_id', blog_id)
        .whereExists('blog', blog => applyBlogAccess(blog, userID))
        .related('author')
  ),

  // Subscribers for a blog
  subscribers: defineQuery(
    z.object({ blog_id: z.string() }),
    ({ args: { blog_id }, ctx: { userID } }) =>
      applyBlogSubscriberPrivateAccess(zql.subscriber.where('blog_id', blog_id), userID)
        .whereExists('blog', blog => applyBlogAccess(blog, userID))
        .related('subscriber_user')
        .related('blog')
  ),

  // Blog thread with comments (one thread per blog via blog_id FK)
  blogThread: defineQuery(
    z.object({ blog_id: z.string() }),
    ({ args: { blog_id }, ctx: { userID } }) =>
      zql.thread
        .where('blog_id', blog_id)
        .whereExists('blog', blog => applyBlogAccess(blog, userID))
        .related('comments', q =>
          q
            .related('user')
            .related('votes', q2 => applyBlogCommentVotePrivateAccess(q2, userID).related('user'))
            .related('parent')
            .related('replies', q2 =>
              q2
                .related('user')
                .related('votes', q3 =>
                  applyBlogCommentVotePrivateAccess(q3, userID).related('user')
                )
            )
        )
        .one()
  ),

  bloggersByUser: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.blog_blogger
        .where('user_id', user_id)
        .where('user_id', userID)
        .whereExists('blog', blog => applyBlogAccess(blog, userID))
        .related('blog', q =>
          applyBlogAccess(q, userID).related('blog_hashtags', q => q.related('hashtag'))
        )
        .related('user')
        .related('role', role => role.related('blog_action_rights'))
  ),

  byGroupWithHashtags: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyBlogAccess(zql.blog.where('group_id', group_id), userID).related('blog_hashtags', q =>
        q.related('hashtag')
      )
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type BlogByIdWithDetailsRow = QueryRowType<typeof blogQueries.byIdWithDetails>;
export type BlogByIdWithBloggersRow = QueryRowType<typeof blogQueries.byIdWithBloggers>;
export type BlogByIdForEditorRow = QueryRowType<typeof blogQueries.byIdForEditor>;
export type BlogByIdWithManagementRow = QueryRowType<typeof blogQueries.byIdWithManagement>;
export type BlogVersionRow = QueryRowType<typeof blogQueries.versionsByBlogId>;
export type BlogThreadRow = QueryRowType<typeof blogQueries.blogThread>;
export type BloggersByUserRow = QueryRowType<typeof blogQueries.bloggersByUser>;
export type BlogPageByGroupRow = QueryRowType<typeof blogQueries.pageByGroup>;
