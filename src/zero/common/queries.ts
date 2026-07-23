import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyDocumentQueryAccess,
  applyElectionQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyEventQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyGroupQueryAccess,
  applyTodoQueryAccess,
  applyStatementQueryAccess,
  applyUserQueryAccess,
  isAuthenticatedUserId,
} from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

function applySubscriberQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  return query.where(({ or, cmp, exists }: any) =>
    or(
      isAuthenticatedUserId(userID)
        ? cmp('subscriber_id', userID)
        : cmp('subscriber_id', '__anon__'),
      exists('user', (user: any) => applyUserQueryAccess(user, userID)),
      exists('group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID)),
      exists('event', (event: any) => applyEventQueryAccess(event, userID)),
      exists('blog', (blog: any) => applyBlogQueryAccess(blog, userID))
    )
  ) as T;
}

function applyLinkQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  return query.where(({ or, cmp, exists }: any) =>
    or(
      isAuthenticatedUserId(userID) ? cmp('user_id', userID) : cmp('user_id', '__anon__'),
      exists('user', (user: any) => applyUserQueryAccess(user, userID)),
      exists('group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('event', (event: any) => applyEventQueryAccess(event, userID))
    )
  ) as T;
}

function applyTimelineEventAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  return query.where(({ or, cmp, exists }: any) =>
    or(
      isAuthenticatedUserId(userID) ? cmp('actor_id', userID) : cmp('actor_id', '__anon__'),
      isAuthenticatedUserId(userID) ? cmp('user_id', userID) : cmp('user_id', '__anon__'),
      exists('user', (user: any) => applyUserQueryAccess(user, userID)),
      exists('group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID)),
      exists('event', (event: any) => applyEventQueryAccess(event, userID)),
      exists('blog', (blog: any) => applyBlogQueryAccess(blog, userID)),
      exists('todo', (todo: any) => applyTodoQueryAccess(todo, userID)),
      exists('statement', (statement: any) => applyStatementQueryAccess(statement, userID)),
      exists('election', (election: any) => applyElectionQueryAccess(election, userID))
    )
  ) as T;
}

export const commonQueries = {
  // Subscribers for an entity
  subscribers: defineQuery(
    z.object({
      user_id: z.string().optional(),
      group_id: z.string().optional(),
      amendment_id: z.string().optional(),
      event_id: z.string().optional(),
      blog_id: z.string().optional(),
    }),
    ({ args, ctx: { userID } }) => {
      let q = applySubscriberQueryAccess(zql.subscriber, userID);
      if (args.user_id) q = q.where('user_id', args.user_id);
      if (args.group_id) q = q.where('group_id', args.group_id);
      if (args.amendment_id) q = q.where('amendment_id', args.amendment_id);
      if (args.event_id) q = q.where('event_id', args.event_id);
      if (args.blog_id) q = q.where('blog_id', args.blog_id);
      return q.orderBy('created_at', 'desc');
    }
  ),

  // Subscribers for a user with related user objects
  subscribersForUser: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      zql.subscriber
        .where('user_id', userId)
        .where('user_id', userID)
        .related('subscriber_user')
        .related('user')
        .orderBy('created_at', 'desc')
  ),

  // All canonical hashtags (for typeahead)
  allHashtags: defineQuery(z.object({}), () => zql.hashtag.orderBy('tag', 'asc')),

  // Canonical hashtags with their accessible usages, used to rank onboarding suggestions.
  onboardingHashtagUsage: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.hashtag
      .related('user_hashtags', links =>
        links.whereExists('user', user => applyUserQueryAccess(user, userID))
      )
      .related('group_hashtags', links =>
        links.whereExists('group', group => applyGroupQueryAccess(group, userID))
      )
      .related('amendment_hashtags', links =>
        links.whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
      )
      .related('event_hashtags', links =>
        links.whereExists('event', event => applyEventQueryAccess(event, userID))
      )
      .related('blog_hashtags', links =>
        links.whereExists('blog', blog => applyBlogQueryAccess(blog, userID))
      )
      .related('statement_hashtags', links =>
        links.whereExists('statement', statement => applyStatementQueryAccess(statement, userID))
      )
      .orderBy('tag', 'asc')
  ),

  // Hashtags for a user (via junction)
  userHashtags: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.user_hashtag
        .where('user_id', user_id)
        .whereExists('user', user => applyUserQueryAccess(user, userID))
        .related('hashtag')
        .orderBy('created_at', 'desc')
  ),

  // Hashtags for a group (via junction)
  groupHashtags: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      zql.group_hashtag
        .where('group_id', group_id)
        .whereExists('group', group => applyGroupQueryAccess(group, userID))
        .related('hashtag')
        .orderBy('created_at', 'desc')
  ),

  // Hashtags for an amendment (via junction)
  amendmentHashtags: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.amendment_hashtag
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
        .related('hashtag')
        .orderBy('created_at', 'desc')
  ),

  // Hashtags for an event (via junction)
  eventHashtags: defineQuery(
    z.object({ event_id: z.string() }),
    ({ args: { event_id }, ctx: { userID } }) =>
      zql.event_hashtag
        .where('event_id', event_id)
        .whereExists('event', event => applyEventQueryAccess(event, userID))
        .related('hashtag')
        .orderBy('created_at', 'desc')
  ),

  // Hashtags for a blog (via junction)
  blogHashtags: defineQuery(
    z.object({ blog_id: z.string() }),
    ({ args: { blog_id }, ctx: { userID } }) =>
      zql.blog_hashtag
        .where('blog_id', blog_id)
        .whereExists('blog', blog => applyBlogQueryAccess(blog, userID))
        .related('hashtag')
        .orderBy('created_at', 'desc')
  ),

  // Hashtags for a statement (via junction)
  statementHashtags: defineQuery(
    z.object({ statement_id: z.string() }),
    ({ args: { statement_id }, ctx: { userID } }) =>
      zql.statement_hashtag
        .where('statement_id', statement_id)
        .whereExists('statement', statement => applyStatementQueryAccess(statement, userID))
        .related('hashtag')
        .orderBy('created_at', 'desc')
  ),

  // Links for a group or user
  links: defineQuery(
    z.object({
      group_id: z.string().optional(),
      user_id: z.string().optional(),
    }),
    ({ args, ctx: { userID } }) => {
      let q = applyLinkQueryAccess(zql.link, userID);
      if (args.group_id) q = q.where('group_id', args.group_id);
      if (args.user_id) q = q.where('user_id', args.user_id);
      return q.orderBy('created_at', 'desc');
    }
  ),

  // Timeline events for a specific entity
  timelineByEntity: defineQuery(
    z.object({ entity_type: z.string(), entity_id: z.string() }),
    ({ args: { entity_type, entity_id }, ctx: { userID } }) =>
      applyTimelineEventAccess(zql.timeline_event, userID)
        .where('entity_type', entity_type)
        .where('entity_id', entity_id)
        .orderBy('created_at', 'desc')
  ),

  timelineFeedPage: defineQuery(
    z.object({
      entityIds: z.array(z.string()).default([]),
      contentTypes: z.array(z.string()).default([]),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { entityIds, contentTypes, limit, start, dir }, ctx: { userID } }) => {
      let q = applyTimelineEventAccess(zql.timeline_event, userID);
      if (entityIds.length > 0) q = q.where('entity_id', 'IN', entityIds);
      if (contentTypes.length > 0) q = q.where('content_type', 'IN', contentTypes);
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('actor')
        .related('user', user => user.related('user_hashtags', h => h.related('hashtag')))
        .related('group')
        .related('event', event =>
          event
            .related('event_hashtags', h => h.related('hashtag'))
            .related('participants', participant =>
              applyEventParticipantOrManagerQueryAccess(participant, userID)
            )
        )
        .related('amendment', amendment =>
          amendment.related('amendment_hashtags', h => h.related('hashtag'))
        )
        .related('blog', blog => blog.related('blog_hashtags', h => h.related('hashtag')))
        .related('statement', statement => statement.related('user'))
        .related('election', election =>
          election.related('agenda_item', item => item.related('event'))
        )
        .limit(limit);
    }
  ),

  timelineFeedById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyTimelineEventAccess(zql.timeline_event, userID)
      .where('id', id)
      .related('actor')
      .related('user')
      .related('group')
      .related('event')
      .related('amendment')
      .related('blog')
      .related('statement')
      .related('election')
      .one()
  ),

  // Reactions for an entity
  reactions: defineQuery(
    z.object({ entity_id: z.string(), entity_type: z.string() }),
    ({ args: { entity_id, entity_type }, ctx: { userID } }) =>
      zql.reaction
        .where('entity_id', entity_id)
        .where('entity_type', entity_type)
        .where(({ or, cmp, exists }: any) =>
          or(
            isAuthenticatedUserId(userID) ? cmp('user_id', userID) : cmp('user_id', '__anon__'),
            exists('timeline_event', (event: any) => applyTimelineEventAccess(event, userID))
          )
        )
        .orderBy('created_at', 'desc')
  ),

  // User subscriptions with basic related entities
  userSubscriptions: defineQuery(
    z.object({ subscriber_id: z.string() }),
    ({ args: { subscriber_id }, ctx: { userID } }) =>
      zql.subscriber
        .where('subscriber_id', subscriber_id)
        .where('subscriber_id', userID)
        .related('user')
        .related('group')
        .related('amendment')
        .related('event', q => q.related('creator'))
        .related('blog')
  ),

  // User subscriptions with deep related entities for timeline
  userSubscriptionsForTimeline: defineQuery(
    z.object({ subscriber_id: z.string() }),
    ({ args: { subscriber_id }, ctx: { userID } }) =>
      zql.subscriber
        .where('subscriber_id', subscriber_id)
        .where('subscriber_id', userID)
        .related('user')
        .related('group', q =>
          q
            .related('group_hashtags', q => q.related('hashtag'))
            .related('events')
            .related('amendments')
        )
        .related('amendment')
        .related('event', q => q.related('creator'))
        .related('blog')
  ),

  subscriptionPage: defineQuery(
    z.object({
      subscriberId: z.string(),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { subscriberId, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'backward' ? 'asc' : 'desc';
      let q = zql.subscriber
        .where('subscriber_id', subscriberId)
        .where('subscriber_id', userID)
        .orderBy('created_at', direction)
        .orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('user')
        .related('group')
        .related('amendment')
        .related('event')
        .related('blog')
        .limit(limit);
    }
  ),

  subscriptionById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    zql.subscriber
      .where('id', id)
      .where('subscriber_id', userID)
      .related('user')
      .related('group')
      .related('amendment')
      .related('event')
      .related('blog')
      .one()
  ),

  // Entity subscribers (users subscribed to a user/entity)
  userSubscribers: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.subscriber.where('user_id', user_id).where('user_id', userID).related('subscriber_user')
  ),

  // Timeline events by entity IDs with deep relations
  timelineEventsByEntityIds: defineQuery(
    z.object({ entity_ids: z.array(z.string()) }),
    ({ args: { entity_ids }, ctx: { userID } }) =>
      applyTimelineEventAccess(zql.timeline_event, userID)
        .where('entity_id', 'IN', entity_ids)
        .related('actor')
        .related('user', q =>
          q
            .related('user_hashtags', q => q.related('hashtag'))
            .related('group_memberships', q =>
              applyGroupMembershipSelfOrManagerQueryAccess(q, userID)
            )
            .related('amendment_collaborations', q =>
              q
                .where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
                .whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
            )
        )
        .related('group')
        .related('amendment', q =>
          q
            .related('documents', q => applyDocumentQueryAccess(q, userID))
            .related('amendment_hashtags', q => q.related('hashtag'))
            .related('collaborators', q =>
              q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
            )
            .related('support_votes', q =>
              q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
            )
            .related('change_requests', q =>
              q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
            )
        )
        .related('event', q =>
          q
            .related('creator')
            .related('event_hashtags', q => q.related('hashtag'))
            .related('participants', q => applyEventParticipantOrManagerQueryAccess(q, userID))
            .related('roles', q =>
              q
                .whereExists('event', event => applyEventManagerQueryAccess(event, userID))
                .related('holders')
            )
            .related('agenda_items', q =>
              applyAgendaItemQueryAccess(q, userID)
                .related('election', election => applyElectionQueryAccess(election, userID))
                .related('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
            )
        )
        .related('blog', q => q.related('blog_hashtags', q => q.related('hashtag')))
        .related('todo', q => q.related('group').related('creator'))
        .related('statement', q => q.related('user'))
        .related('election', q => q.related('agenda_item', q => q.related('event')))
  ),

  // Timeline events by content types with basic relations
  timelineEventsByContentTypes: defineQuery(
    z.object({ content_types: z.array(z.string()), limit: z.number() }),
    ({ args: { content_types, limit }, ctx: { userID } }) =>
      applyTimelineEventAccess(zql.timeline_event, userID)
        .where('content_type', 'IN', content_types)
        .related('actor')
        .related('group')
        .related('event')
        .limit(limit)
  ),
};

export type LinkRow = QueryRowType<typeof commonQueries.links>;
export type TimelineEventByEntityRow = QueryRowType<typeof commonQueries.timelineByEntity>;
export type TimelineEventsByEntityIdsRow = QueryRowType<
  typeof commonQueries.timelineEventsByEntityIds
>;
export type ReactionRow = QueryRowType<typeof commonQueries.reactions>;
export type SubscriberRow = QueryRowType<typeof commonQueries.subscribers>;
export type SubscriptionPageRow = QueryRowType<typeof commonQueries.subscriptionPage>;
export type TimelineFeedPageRow = QueryRowType<typeof commonQueries.timelineFeedPage>;
export type UserSubscriptionRow = QueryRowType<typeof commonQueries.userSubscriptions>;
export type TimelineEventsByContentTypeRow = QueryRowType<
  typeof commonQueries.timelineEventsByContentTypes
>;
