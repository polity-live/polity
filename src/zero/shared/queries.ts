import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyElectionQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyEventQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyGroupQueryAccess,
  applyStatementQueryAccess,
  applyTodoQueryAccess,
  applyUserQueryAccess,
  isAuthenticatedUserId,
  requireQueryUser,
} from '../rbac/query-access';
import { zql } from '../schema';
import {
  normalizeSearchQuery,
  prefixPattern,
  searchPattern,
  searchSortField,
  searchStartRow,
  sortDirection,
  type SearchBounds,
  type SearchDirection,
  type SearchEngagementFilter,
  type SearchSortOption,
  type SearchStart,
} from './search-query-helpers';

const searchArgsSchema = z.object({
  limit: z.number(),
  query: z.string().default(''),
});

const searchSortSchema = z.enum(['recent', 'engagement', 'trending']);
const searchDirectionSchema = z.enum(['forward', 'backward']);
const searchEngagementSchema = z.enum(['all', 'popular', 'rising', 'discussed']);

const searchStartSchema = z
  .object({
    id: z.string(),
    created_at: z.number(),
    engagement_score: z.number().optional(),
    trending_score: z.number().optional(),
  })
  .nullable();
const searchBoundsSchema = z
  .object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  })
  .nullable();

const searchDocumentPageArgsSchema = z.object({
  query: z.string().default(''),
  types: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  createdAfter: z.number().nullable().default(null),
  engagement: searchEngagementSchema.default('all'),
  sort: searchSortSchema.default('recent'),
  snapshotAt: z.number().nullable().default(null),
  limit: z.number().min(1).max(200).default(60),
  start: searchStartSchema.default(null),
  dir: searchDirectionSchema.default('forward'),
  bounds: searchBoundsSchema.default(null),
});

function applySearchAccess(q: any, userID: string | undefined) {
  if (!userID || userID === 'anon') {
    return q.where('visibility', 'public');
  }

  return q.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('owner_user_id', userID),
      exists('acl', (acl: any) => acl.where('user_id', userID)),
      exists('group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      )
    )
  );
}

function applySearchText(q: any, query: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return q;

  if (normalizedQuery.length === 1) {
    const prefix = prefixPattern(normalizedQuery);
    return q.where(({ or, cmp }: any) =>
      or(cmp('title', 'ILIKE', prefix), cmp('subtitle', 'ILIKE', prefix))
    );
  }

  return q.where('search_text', 'ILIKE', searchPattern(normalizedQuery));
}

function applyEngagementFilter(q: any, engagement: SearchEngagementFilter) {
  if (engagement === 'popular') return q.where('engagement_score', '>=', 5);
  if (engagement === 'rising') return q.where('trending_score', '>=', 1);
  if (engagement === 'discussed') return q.where('engagement_score', '>=', 1);
  return q;
}

function applySpatialBounds(q: any, bounds: SearchBounds | null) {
  if (!bounds) return q;

  const south = Math.min(bounds.south, bounds.north);
  const north = Math.max(bounds.south, bounds.north);
  const west = bounds.west;
  const east = bounds.east;

  q = q.where('location_latitude', '>=', south).where('location_latitude', '<=', north);

  if (west <= east) {
    return q.where('location_longitude', '>=', west).where('location_longitude', '<=', east);
  }

  return q.where(({ or, cmp }: any) =>
    or(cmp('location_longitude', '>=', west), cmp('location_longitude', '<=', east))
  );
}

function applySearchOrdering(
  q: any,
  sort: SearchSortOption,
  dir: SearchDirection,
  start: SearchStart | null
) {
  const direction = sortDirection(dir);
  const sortField = searchSortField(sort);
  const startRow = searchStartRow(start, sort);

  if (sortField !== 'created_at') {
    q = q.orderBy(sortField, direction);
  }

  q = q.orderBy('created_at', direction).orderBy('id', direction);

  if (startRow) {
    q = q.start(startRow, { inclusive: false });
  }

  return q;
}

export const searchQueries = {
  searchDocumentPage: defineQuery(
    searchDocumentPageArgsSchema,
    ({
      args: {
        query,
        types,
        topics,
        createdAfter,
        engagement,
        sort,
        snapshotAt,
        limit,
        start,
        dir,
        bounds,
      },
      ctx: { userID },
    }) => {
      let q: any = zql.search_document.related('topics').related('group');
      q = applySearchAccess(q, userID);
      q = applySearchText(q, query);
      q = applySpatialBounds(q, bounds);

      const normalizedTypes = types.map(type => type.trim()).filter(Boolean);
      if (normalizedTypes.length > 0) {
        q = q.where('entity_type', 'IN', normalizedTypes);
      }

      const normalizedTopics = topics.map(normalizeSearchQuery).filter(Boolean);
      for (const topic of normalizedTopics) {
        q = q.whereExists('topics', (topicQuery: any) => topicQuery.where('topic', topic));
      }

      if (createdAfter != null) {
        q = q.where('created_at', '>=', createdAfter);
      }

      if (snapshotAt != null) {
        q = q.where('created_at', '<=', snapshotAt);
      }

      q = applyEngagementFilter(q, engagement);
      q = applySearchOrdering(q, sort, dir, start);

      return q.limit(limit);
    }
  ),

  searchDocumentById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) => {
      let q: any = zql.search_document.related('topics').related('group').where('id', id);
      q = applySearchAccess(q, userID);
      return q.one();
    }
  ),

  searchDocumentTopics: defineQuery(
    z.object({ limit: z.number().min(1).max(500).default(120) }),
    ({ args: { limit } }) =>
      zql.search_document_topic.orderBy('topic', 'asc').orderBy('document_id', 'asc').limit(limit)
  ),

  searchableUsers: defineQuery(searchArgsSchema, ({ args: { limit, query }, ctx: { userID } }) => {
    const normalizedQuery = query.trim();
    const usersQuery = normalizedQuery
      ? applyUserQueryAccess(zql.user, userID).where(({ or, cmp }) =>
          or(
            cmp('handle', 'ILIKE', `%${normalizedQuery}%`),
            cmp('first_name', 'ILIKE', `%${normalizedQuery}%`),
            cmp('last_name', 'ILIKE', `%${normalizedQuery}%`)
          )
        )
      : applyUserQueryAccess(zql.user, userID);

    return usersQuery
      .related('user_hashtags', q => q.related('hashtag'))
      .related('group_memberships', q =>
        applyGroupMembershipSelfOrManagerQueryAccess(q, userID).whereExists('group', group =>
          applyGroupQueryAccess(group, userID)
        )
      )
      .related('amendment_collaborations', q =>
        q
          .where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
          .whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
      )
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableGroups: defineQuery(searchArgsSchema, ({ args: { limit, query }, ctx: { userID } }) => {
    const normalizedQuery = query.trim();
    const groupsQuery = normalizedQuery
      ? applyGroupQueryAccess(zql.group, userID).where('name', 'ILIKE', `%${normalizedQuery}%`)
      : applyGroupQueryAccess(zql.group, userID);

    return groupsQuery
      .related('owner')
      .related('group_hashtags', q => q.related('hashtag'))
      .related('memberships', q =>
        q
          .where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
          .related('user')
          .related('membership_roles', mq => mq.related('role'))
      )
      .related('events', q => applyEventQueryAccess(q, userID))
      .related('amendments', q => applyAmendmentQueryAccess(q, userID))
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableStatements: defineQuery(
    searchArgsSchema,
    ({ args: { limit, query }, ctx: { userID } }) => {
      const normalizedQuery = query.trim();
      const statementsQuery = normalizedQuery
        ? applyStatementQueryAccess(zql.statement, userID).where(
            'text',
            'ILIKE',
            `%${normalizedQuery}%`
          )
        : applyStatementQueryAccess(zql.statement, userID);

      return statementsQuery
        .related('user')
        .related('group')
        .related('statement_hashtags', q => q.related('hashtag'))
        .related('support_votes', q =>
          q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
        )
        .related('surveys', q =>
          q.related('options', q2 =>
            q2.related('votes', q3 =>
              q3.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
            )
          )
        )
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),

  searchableBlogs: defineQuery(searchArgsSchema, ({ args: { limit, query }, ctx: { userID } }) => {
    const normalizedQuery = query.trim();
    const blogsQuery = normalizedQuery
      ? applyBlogQueryAccess(zql.blog, userID).where(({ or, cmp }) =>
          or(
            cmp('title', 'ILIKE', `%${normalizedQuery}%`),
            cmp('description', 'ILIKE', `%${normalizedQuery}%`)
          )
        )
      : applyBlogQueryAccess(zql.blog, userID);

    return blogsQuery
      .related('group')
      .related('blog_hashtags', q => q.related('hashtag'))
      .related('bloggers', q =>
        q
          .where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
          .related('user')
          .related('role')
      )
      .related('support_votes', q =>
        q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__').related('user')
      )
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableAmendments: defineQuery(
    searchArgsSchema,
    ({ args: { limit, query }, ctx: { userID } }) => {
      const normalizedQuery = query.trim();
      const amendmentsQuery = normalizedQuery
        ? applyAmendmentQueryAccess(zql.amendment, userID).where(({ or, cmp }) =>
            or(
              cmp('title', 'ILIKE', `%${normalizedQuery}%`),
              cmp('reason', 'ILIKE', `%${normalizedQuery}%`),
              cmp('preamble', 'ILIKE', `%${normalizedQuery}%`)
            )
          )
        : applyAmendmentQueryAccess(zql.amendment, userID);

      return amendmentsQuery
        .related('amendment_hashtags', q => q.related('hashtag'))
        .related('collaborators', q =>
          q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__').related('user')
        )
        .related('vote_entries', q => q.related('choices'))
        .related('support_votes', q =>
          q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__').related('user')
        )
        .related('change_requests', q =>
          q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
        )
        .related('group')
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),

  searchableEvents: defineQuery(searchArgsSchema, ({ args: { limit, query }, ctx: { userID } }) => {
    const normalizedQuery = query.trim();
    const eventsQuery = normalizedQuery
      ? applyEventQueryAccess(zql.event, userID).where(({ or, cmp }) =>
          or(
            cmp('title', 'ILIKE', `%${normalizedQuery}%`),
            cmp('location_name', 'ILIKE', `%${normalizedQuery}%`)
          )
        )
      : applyEventQueryAccess(zql.event, userID);

    return eventsQuery
      .related('creator')
      .related('group')
      .related('participants', q =>
        applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
      )
      .related('event_hashtags', q => q.related('hashtag'))
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
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  userGroupMemberships: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      requireQueryUser(zql.group_membership, userID)
        .where('user_id', user_id)
        .related('group')
        .related('membership_roles', q => q.related('role'))
  ),

  userTodoAssignments: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      requireQueryUser(zql.todo_assignment, userID)
        .where('user_id', user_id)
        .related('todo', q =>
          applyTodoQueryAccess(q, userID)
            .related('group')
            .related('creator')
            .related('assignments', q =>
              q
                .where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__')
                .related('user')
            )
        )
        .related('user')
  ),

  searchableTodos: defineQuery(searchArgsSchema, ({ args: { limit, query }, ctx: { userID } }) => {
    const normalizedQuery = query.trim();
    const todosQuery = normalizedQuery
      ? applyTodoQueryAccess(zql.todo, userID).where('title', 'ILIKE', `%${normalizedQuery}%`)
      : applyTodoQueryAccess(zql.todo, userID);

    return todosQuery
      .related('group')
      .related('creator')
      .related('assignments', q =>
        q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__').related('user')
      )
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableTodosByCreator: defineQuery(
    z.object({ user_id: z.string(), limit: z.number(), query: z.string().default('') }),
    ({ args: { user_id, limit, query }, ctx: { userID } }) => {
      const normalizedQuery = query.trim();
      const todosQuery = normalizedQuery
        ? requireQueryUser(applyTodoQueryAccess(zql.todo, userID), userID, 'creator_id')
            .where('creator_id', user_id)
            .where('title', 'ILIKE', `%${normalizedQuery}%`)
        : requireQueryUser(applyTodoQueryAccess(zql.todo, userID), userID, 'creator_id').where(
            'creator_id',
            user_id
          );

      return todosQuery
        .related('group')
        .related('creator')
        .related('assignments', q =>
          q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__').related('user')
        )
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),

  searchableTodosByGroups: defineQuery(
    z.object({ group_ids: z.array(z.string()), limit: z.number(), query: z.string().default('') }),
    ({ args: { group_ids, limit, query }, ctx: { userID } }) => {
      const normalizedQuery = query.trim();
      const todosQuery = normalizedQuery
        ? applyTodoQueryAccess(zql.todo, userID)
            .where('group_id', 'IN', group_ids)
            .where('title', 'ILIKE', `%${normalizedQuery}%`)
        : applyTodoQueryAccess(zql.todo, userID).where('group_id', 'IN', group_ids);

      return todosQuery
        .related('group')
        .related('creator')
        .related('assignments', q =>
          q.where('user_id', isAuthenticatedUserId(userID) ? userID : '__anon__').related('user')
        )
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),
};
