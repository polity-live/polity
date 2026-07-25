import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyEventQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyGroupQueryAccess,
  applyStatementQueryAccess,
  applyUserQueryAccess,
  applyVoteQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';

// Old clients invoke fullProfile with only {id}. Freeze their compatibility
// cutoff for this server process so repeated transformations remain identical.
const LEGACY_FULL_PROFILE_NOW = Date.now();

function applyUserAccess<T>(q: T, userID: string | undefined): T {
  return applyUserQueryAccess(q, userID);
}

export const userQueries = {
  current: defineQuery(z.object({}), ({ ctx: { userID } }) => zql.user.where('id', userID).one()),

  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyUserAccess(zql.user.where('id', id), userID).one()
  ),

  byHandle: defineQuery(z.object({ handle: z.string() }), ({ args: { handle }, ctx: { userID } }) =>
    applyUserAccess(zql.user.where('handle', handle), userID).one()
  ),

  search: defineQuery(z.object({ query: z.string() }), ({ args: { query }, ctx: { userID } }) =>
    applyUserAccess(zql.user.where('handle', 'ILIKE', `%${query}%`), userID).orderBy(
      'handle',
      'asc'
    )
  ),

  publicUsers: defineQuery(z.object({}), () => zql.user.where('visibility', 'public')),

  followers: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      zql.follow
        .where('followee_id', userId)
        .whereExists('followee', user => applyUserAccess(user, userID))
        .whereExists('follower', user => applyUserAccess(user, userID))
        .related('follower', user => applyUserAccess(user, userID))
        .orderBy('created_at', 'desc')
  ),

  following: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      zql.follow
        .where('follower_id', userId)
        .whereExists('follower', user => applyUserAccess(user, userID))
        .whereExists('followee', user => applyUserAccess(user, userID))
        .related('followee', user => applyUserAccess(user, userID))
        .orderBy('created_at', 'desc')
  ),

  wikiProfile: defineQuery(
    z.object({ id: z.string(), now: z.number() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyUserAccess(zql.user.where('id', id), userID)
        .related('user_hashtags', q => q.related('hashtag'))
        .one()
  ),

  fullProfile: defineQuery(
    z.object({ id: z.string(), now: z.number().optional() }),
    ({ args: { id, now }, ctx: { userID } }) =>
      applyUserAccess(zql.user.where('id', id), userID)
        .related('statements', q =>
          applyStatementQueryAccess(q, userID, now ?? LEGACY_FULL_PROFILE_NOW)
            .related('group', group => applyGroupQueryAccess(group, userID))
            .related('statement_hashtags', q2 => q2.related('hashtag'))
            .related('support_votes', q2 => q2.where('user_id', userID ?? '__anon__'))
            .related('surveys', q2 =>
              q2.related('options', q3 =>
                q3.related('votes', q4 => q4.where('user_id', userID ?? '__anon__'))
              )
            )
        )
        .related('group_memberships', q =>
          applyGroupMembershipSelfOrManagerQueryAccess(q, userID)
            .whereExists('group', group => applyGroupQueryAccess(group, userID))
            .related('group', q =>
              applyGroupQueryAccess(q, userID)
                .related('events', event => applyEventQueryAccess(event, userID))
                .related('amendments', amendment => applyAmendmentQueryAccess(amendment, userID))
                .related('group_hashtags', q => q.related('hashtag'))
            )
            .related('membership_roles', mq =>
              (id === userID ? mq : mq.where('id', '__private__')).related('role', rq =>
                rq.related('action_rights')
              )
            )
        )
        .related('blogger_relations', q =>
          q
            .whereExists('blog', blog => applyBlogQueryAccess(blog, userID))
            .related('blog', q =>
              applyBlogQueryAccess(q, userID).related('blog_hashtags', q => q.related('hashtag'))
            )
            .related('role', q =>
              (id === userID ? q : q.where('id', '__private__')).related('action_rights')
            )
        )
        .related('user_hashtags', q => q.related('hashtag'))
        .related('amendment_collaborations', q =>
          q
            .where('user_id', userID ?? '__anon__')
            .whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
            .related('amendment', q =>
              applyAmendmentQueryAccess(q, userID)
                .related('group', group => applyGroupQueryAccess(group, userID))
                .related('amendment_hashtags', q => q.related('hashtag'))
                .related('collaborators', q => q.where('user_id', userID ?? '__anon__'))
                .related('change_requests', q => q.where('user_id', userID ?? '__anon__'))
                .related('vote_entries', q => applyVoteQueryAccess(q, userID))
                .related('current_process_run', q =>
                  q.related('branches', bq => bq.orderBy('created_at', 'asc'))
                )
            )
        )
  ),

  allUsers: defineQuery(z.object({}), ({ ctx: { userID } }) => applyUserAccess(zql.user, userID)),

  byIds: defineQuery(z.object({ ids: z.array(z.string()) }), ({ args: { ids }, ctx: { userID } }) =>
    applyUserAccess(zql.user.where('id', 'IN', ids), userID)
  ),

  withGroupMemberships: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyUserAccess(zql.user.where('id', id), userID).related('group_memberships', q =>
        applyGroupMembershipSelfOrManagerQueryAccess(q, userID)
          .whereExists('group', group => applyGroupQueryAccess(group, userID))
          .related('group', group => applyGroupQueryAccess(group, userID))
          .related('membership_roles', mq =>
            (id === userID ? mq : mq.where('id', '__private__')).related('role')
          )
      )
  ),

  searchableUsers: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyUserAccess(zql.user, userID)
      .related('user_hashtags', q => q.related('hashtag'))
      .related('group_memberships', q =>
        applyGroupMembershipSelfOrManagerQueryAccess(q, userID).whereExists('group', group =>
          applyGroupQueryAccess(group, userID)
        )
      )
      .related('amendment_collaborations', q =>
        q
          .where('user_id', userID ?? '__anon__')
          .whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
      )
  ),
};

export type UserCurrentRow = QueryRowType<typeof userQueries.current>;
export type UserByIdRow = QueryRowType<typeof userQueries.byId>;
export type UserByHandleRow = QueryRowType<typeof userQueries.byHandle>;
export type UserWikiProfileRow = QueryRowType<typeof userQueries.wikiProfile>;
export type UserFullProfileRow = QueryRowType<typeof userQueries.fullProfile>;
export type UserSearchRow = QueryRowType<typeof userQueries.search>;
