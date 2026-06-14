import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

function applyBlogAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('bloggers', (blogger: any) => blogger.where('user_id', userID)),
      exists('group', (group: any) =>
        group.where(({ or, cmp, exists }: any) =>
          or(
            cmp('visibility', 'IN', ['public', 'authenticated']),
            cmp('owner_id', userID),
            exists('memberships', (membership: any) => membership.where('user_id', userID)),
            exists('guest_accesses', (guestAccess: any) => guestAccess.where('user_id', userID))
          )
        )
      )
    )
  ) as T;
}

function applyBlogManagerAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.whereExists('bloggers', (blogger: any) =>
    blogger.where('user_id', userID).where(({ or, cmp, exists }: any) =>
      or(
        cmp('status', 'IN', ['owner', 'admin']),
        exists('role', (role: any) =>
          role.whereExists('action_rights', (right: any) =>
            right.where('resource', 'IN', ['blogs', 'blogBloggers']).where('action', 'manage')
          )
        )
      )
    )
  ) as T;
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
  // Blogs by the current user (as blogger)
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.blog_blogger.where('user_id', userID).related('blog').orderBy('created_at', 'desc')
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
        .related('blog', q => q.related('blog_hashtags', q => q.related('hashtag')))
        .related('user')
        .related('role')
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
