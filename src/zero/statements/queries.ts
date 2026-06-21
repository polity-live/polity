import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import { isAuthenticatedUserId } from '../rbac/query-access';

function applyStatementExpiryAccess<T>(q: T, userID: string | undefined, now = Date.now()): T {
  const query = q as any;

  if (isAuthenticatedUserId(userID)) {
    return query.where(({ or, cmp }: any) =>
      or(cmp('expires_at', 'IS', null), cmp('expires_at', '>', now), cmp('user_id', userID))
    ) as T;
  }

  return query.where(({ or, cmp }: any) =>
    or(cmp('expires_at', 'IS', null), cmp('expires_at', '>', now))
  ) as T;
}

function applyStatementAccess<T>(q: T, userID: string | undefined, now = Date.now()): T {
  const query = q as any;
  const visibleQuery = applyStatementExpiryAccess(query, userID, now) as any;

  if (!userID || userID === 'anon') {
    return visibleQuery.where('visibility', 'public') as T;
  }

  return visibleQuery.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('user_id', userID),
      exists('group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      )
    )
  ) as T;
}

export const statementQueries = {
  // Statements by the current user
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.statement
      .where('user_id', userID)
      .related('user')
      .related('statement_hashtags', q => q.related('hashtag'))
      .related('support_votes', q => q.where('user_id', userID ?? '__anon__'))
      .related('surveys', q =>
        q.related('options', q2 =>
          q2.related('votes', q3 => q3.where('user_id', userID ?? '__anon__'))
        )
      )
      .orderBy('created_at', 'desc')
  ),

  // Statements belonging to a group
  byGroup: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('group_id', group_id), userID)
        .related('user')
        .related('statement_hashtags', q => q.related('hashtag'))
        .related('support_votes', q => q.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
  ),

  carousel: defineQuery(
    z.object({
      user_id: z.string().nullable().optional(),
      now: z.number(),
      limit: z.number().min(1).max(100).default(24),
    }),
    ({ args: { user_id, now, limit }, ctx: { userID } }) => {
      let q: any = applyStatementAccess(zql.statement, userID, now);
      if (user_id) {
        q = q.where('user_id', user_id);
      }

      return q
        .related('user')
        .related('group')
        .related('statement_hashtags', q2 => q2.related('hashtag'))
        .related('support_votes', q2 => q2.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),

  // Single statement by ID
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyStatementAccess(zql.statement.where('id', id), userID).related('user').one()
  ),

  // Statement with full detail relations
  byIdWithDetails: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyStatementAccess(zql.statement.where('id', id), userID)
      .related('user')
      .related('group')
      .related('statement_hashtags', q => q.related('hashtag'))
      .related('support_votes', q => q.where('user_id', userID ?? '__anon__').related('user'))
      .related('surveys', q =>
        q.related('options', q2 =>
          q2.related('votes', q3 => q3.where('user_id', userID ?? '__anon__'))
        )
      )
      .related('threads', q =>
        q
          .related('user')
          .related('comments', q2 =>
            q2
              .related('user')
              .related('votes', q3 => q3.where('user_id', userID ?? '__anon__').related('user'))
              .related('replies', q3 =>
                q3
                  .related('user')
                  .related('votes', q4 => q4.where('user_id', userID ?? '__anon__').related('user'))
                  .related('replies', q4 =>
                    q4
                      .related('user')
                      .related('votes', q5 =>
                        q5.where('user_id', userID ?? '__anon__').related('user')
                      )
                  )
              )
          )
          .related('votes', q2 => q2.where('user_id', userID ?? '__anon__').related('user'))
      )
      .related('timeline_events')
      .one()
  ),

  // Statement with hashtags
  byIdWithHashtags: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyStatementAccess(zql.statement.where('id', id), userID)
      .related('statement_hashtags', q => q.related('hashtag'))
      .one()
  ),

  // Statements by an arbitrary user ID
  byUserId: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('user_id', user_id), userID)
        .related('user')
        .related('statement_hashtags', q => q.related('hashtag'))
        .related('support_votes', q => q.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
  ),

  // Statements filtered by visibility
  byVisibility: defineQuery(
    z.object({ visibility: z.string() }),
    ({ args: { visibility }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('visibility', visibility), userID)
        .related('user')
        .related('statement_hashtags', q => q.related('hashtag'))
        .related('support_votes', q => q.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
  ),
};

export type StatementByIdWithDetailsRow = QueryRowType<typeof statementQueries.byIdWithDetails>;
export type StatementByGroupRow = QueryRowType<typeof statementQueries.byGroup>;
export type StatementByUserRow = QueryRowType<typeof statementQueries.byUser>;
