import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import { applyStatementQueryAccess } from '../rbac/query-access';
import { virtualPageLimitSchema } from '../virtualization';

const statementStartSchema = z.object({ created_at: z.number(), id: z.string() }).nullable();

function applyStatementAccess<T>(q: T, userID: string | undefined, now: number): T {
  return applyStatementQueryAccess(q, userID, now);
}

export const statementQueries = {
  pageByGroup: defineQuery(
    z.object({
      groupId: z.string(),
      query: z.string().default(''),
      now: z.number(),
      limit: virtualPageLimitSchema,
      start: statementStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { groupId, query, now, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = applyStatementAccess(zql.statement.where('group_id', groupId), userID, now)
        .related('user')
        .related('statement_hashtags', (hashtag: any) => hashtag.related('hashtag'))
        .related('support_votes', (vote: any) => vote.where('user_id', userID ?? '__anon__'));
      const normalizedQuery = query.trim();
      if (normalizedQuery) q = q.where('text', 'ILIKE', `%${normalizedQuery}%`);
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  pageByUser: defineQuery(
    z.object({
      userId: z.string(),
      query: z.string().default(''),
      now: z.number(),
      limit: virtualPageLimitSchema,
      start: statementStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { userId, query, now, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = applyStatementAccess(zql.statement.where('user_id', userId), userID, now)
        .related('user')
        .related('group')
        .related('statement_hashtags', (hashtag: any) => hashtag.related('hashtag'))
        .related('support_votes', (vote: any) => vote.where('user_id', userID ?? '__anon__'))
        .related('surveys', (survey: any) =>
          survey.related('options', (option: any) => option.related('votes'))
        );
      const term = query.trim();
      if (term) q = q.where('text', 'ILIKE', `%${term}%`);
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  // Statements by the current user
  byUser: defineQuery(z.object({ now: z.number() }), ({ args: { now }, ctx: { userID } }) =>
    applyStatementAccess(zql.statement.where('user_id', userID), userID, now)
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
    z.object({ group_id: z.string(), now: z.number() }),
    ({ args: { group_id, now }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('group_id', group_id), userID, now)
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
        .related('statement_hashtags', (q2: any) => q2.related('hashtag'))
        .related('support_votes', (q2: any) => q2.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),

  // Single statement by ID
  byId: defineQuery(
    z.object({ id: z.string(), now: z.number() }),
    ({ args: { id, now }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('id', id), userID, now).related('user').one()
  ),

  // Statement with full detail relations
  byIdWithDetails: defineQuery(
    z.object({ id: z.string(), now: z.number() }),
    ({ args: { id, now }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('id', id), userID, now)
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
                    .related('votes', q4 =>
                      q4.where('user_id', userID ?? '__anon__').related('user')
                    )
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
  byIdWithHashtags: defineQuery(
    z.object({ id: z.string(), now: z.number() }),
    ({ args: { id, now }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('id', id), userID, now)
        .related('statement_hashtags', q => q.related('hashtag'))
        .one()
  ),

  // Statements by an arbitrary user ID
  byUserId: defineQuery(
    z.object({ user_id: z.string(), now: z.number() }),
    ({ args: { user_id, now }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('user_id', user_id), userID, now)
        .related('user')
        .related('statement_hashtags', q => q.related('hashtag'))
        .related('support_votes', q => q.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
  ),

  // Statements filtered by visibility
  byVisibility: defineQuery(
    z.object({ visibility: z.string(), now: z.number() }),
    ({ args: { visibility, now }, ctx: { userID } }) =>
      applyStatementAccess(zql.statement.where('visibility', visibility), userID, now)
        .related('user')
        .related('statement_hashtags', q => q.related('hashtag'))
        .related('support_votes', q => q.where('user_id', userID ?? '__anon__'))
        .orderBy('created_at', 'desc')
  ),
};

export type StatementByIdWithDetailsRow = QueryRowType<typeof statementQueries.byIdWithDetails>;
export type StatementByGroupRow = QueryRowType<typeof statementQueries.byGroup>;
export type StatementByUserRow = QueryRowType<typeof statementQueries.byUser>;
export type StatementPageByGroupRow = QueryRowType<typeof statementQueries.pageByGroup>;
