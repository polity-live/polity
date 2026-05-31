import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

const searchArgsSchema = z.object({
  limit: z.number(),
  query: z.string().default(''),
});

export const searchQueries = {
  searchableUsers: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const usersQuery = normalizedQuery
      ? zql.user
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where(({ or, cmp }) =>
            or(
              cmp('handle', 'ILIKE', `%${normalizedQuery}%`),
              cmp('first_name', 'ILIKE', `%${normalizedQuery}%`),
              cmp('last_name', 'ILIKE', `%${normalizedQuery}%`)
            )
          )
      : zql.user.where('visibility', 'IN', ['public', 'authenticated']);

    return usersQuery
      .related('user_hashtags', q => q.related('hashtag'))
      .related('group_memberships')
      .related('amendment_collaborations')
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableGroups: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const groupsQuery = normalizedQuery
      ? zql.group
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where('name', 'ILIKE', `%${normalizedQuery}%`)
      : zql.group.where('visibility', 'IN', ['public', 'authenticated']);

    return groupsQuery
      .related('owner')
      .related('group_hashtags', q => q.related('hashtag'))
      .related('memberships', q =>
        q.related('user').related('membership_roles', mq => mq.related('role'))
      )
      .related('events')
      .related('amendments')
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableStatements: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const statementsQuery = normalizedQuery
      ? zql.statement
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where('text', 'ILIKE', `%${normalizedQuery}%`)
      : zql.statement.where('visibility', 'IN', ['public', 'authenticated']);

    return statementsQuery
      .related('user')
      .related('group')
      .related('statement_hashtags', q => q.related('hashtag'))
      .related('support_votes')
      .related('surveys', q => q.related('options', q2 => q2.related('votes')))
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableBlogs: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const blogsQuery = normalizedQuery
      ? zql.blog
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where(({ or, cmp }) =>
            or(
              cmp('title', 'ILIKE', `%${normalizedQuery}%`),
              cmp('description', 'ILIKE', `%${normalizedQuery}%`)
            )
          )
      : zql.blog.where('visibility', 'IN', ['public', 'authenticated']);

    return blogsQuery
      .related('group')
      .related('blog_hashtags', q => q.related('hashtag'))
      .related('bloggers', q => q.related('user').related('role'))
      .related('support_votes', q => q.related('user'))
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableAmendments: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const amendmentsQuery = normalizedQuery
      ? zql.amendment
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where(({ or, cmp }) =>
            or(
              cmp('title', 'ILIKE', `%${normalizedQuery}%`),
              cmp('reason', 'ILIKE', `%${normalizedQuery}%`),
              cmp('preamble', 'ILIKE', `%${normalizedQuery}%`)
            )
          )
      : zql.amendment.where('visibility', 'IN', ['public', 'authenticated']);

    return amendmentsQuery
      .related('amendment_hashtags', q => q.related('hashtag'))
      .related('collaborators', q => q.related('user'))
      .related('vote_entries', q => q.related('choices'))
      .related('support_votes', q => q.related('user'))
      .related('change_requests')
      .related('group')
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableEvents: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const eventsQuery = normalizedQuery
      ? zql.event
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where(({ or, cmp }) =>
            or(
              cmp('title', 'ILIKE', `%${normalizedQuery}%`),
              cmp('location_name', 'ILIKE', `%${normalizedQuery}%`)
            )
          )
      : zql.event.where('visibility', 'IN', ['public', 'authenticated']);

    return eventsQuery
      .related('creator')
      .related('group')
      .related('participants', q => q.related('user'))
      .related('event_hashtags', q => q.related('hashtag'))
      .related('roles', q => q.related('holders'))
      .related('agenda_items', q => q.related('election').related('amendment'))
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  userGroupMemberships: defineQuery(z.object({ user_id: z.string() }), ({ args: { user_id } }) =>
    zql.group_membership
      .where('user_id', user_id)
      .related('group')
      .related('membership_roles', q => q.related('role'))
  ),

  userTodoAssignments: defineQuery(z.object({ user_id: z.string() }), ({ args: { user_id } }) =>
    zql.todo_assignment
      .where('user_id', user_id)
      .related('todo', q =>
        q
          .related('group')
          .related('creator')
          .related('assignments', q => q.related('user'))
      )
      .related('user')
  ),

  searchableTodos: defineQuery(searchArgsSchema, ({ args: { limit, query } }) => {
    const normalizedQuery = query.trim();
    const todosQuery = normalizedQuery
      ? zql.todo
          .where('visibility', 'IN', ['public', 'authenticated'])
          .where('title', 'ILIKE', `%${normalizedQuery}%`)
      : zql.todo.where('visibility', 'IN', ['public', 'authenticated']);

    return todosQuery
      .related('group')
      .related('creator')
      .related('assignments', q => q.related('user'))
      .orderBy('created_at', 'desc')
      .limit(limit);
  }),

  searchableTodosByCreator: defineQuery(
    z.object({ user_id: z.string(), limit: z.number(), query: z.string().default('') }),
    ({ args: { user_id, limit, query } }) => {
      const normalizedQuery = query.trim();
      const todosQuery = normalizedQuery
        ? zql.todo.where('creator_id', user_id).where('title', 'ILIKE', `%${normalizedQuery}%`)
        : zql.todo.where('creator_id', user_id);

      return todosQuery
        .related('group')
        .related('creator')
        .related('assignments', q => q.related('user'))
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),

  searchableTodosByGroups: defineQuery(
    z.object({ group_ids: z.array(z.string()), limit: z.number(), query: z.string().default('') }),
    ({ args: { group_ids, limit, query } }) => {
      const normalizedQuery = query.trim();
      const todosQuery = normalizedQuery
        ? zql.todo
            .where('group_id', 'IN', group_ids)
            .where('title', 'ILIKE', `%${normalizedQuery}%`)
        : zql.todo.where('group_id', 'IN', group_ids);

      return todosQuery
        .related('group')
        .related('creator')
        .related('assignments', q => q.related('user'))
        .orderBy('created_at', 'desc')
        .limit(limit);
    }
  ),
};
