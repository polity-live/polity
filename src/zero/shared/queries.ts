import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

export const searchQueries = {
  searchableUsers: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.user
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('user_hashtags', q => q.related('hashtag'))
      .related('group_memberships')
      .related('amendment_collaborations')
      .limit(limit)
  ),

  searchableGroups: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.group
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('owner')
      .related('group_hashtags', q => q.related('hashtag'))
      .related('memberships', q =>
        q.related('user').related('membership_roles', mq => mq.related('role'))
      )
      .related('events')
      .related('amendments')
      .limit(limit)
  ),

  searchableStatements: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.statement
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('user')
      .related('group')
      .related('statement_hashtags', q => q.related('hashtag'))
      .related('support_votes')
      .related('surveys', q => q.related('options', q2 => q2.related('votes')))
      .limit(limit)
  ),

  searchableBlogs: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.blog
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('group')
      .related('blog_hashtags', q => q.related('hashtag'))
      .related('bloggers', q => q.related('user').related('role'))
      .related('support_votes', q => q.related('user'))
      .limit(limit)
  ),

  searchableAmendments: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.amendment
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('amendment_hashtags', q => q.related('hashtag'))
      .related('collaborators', q => q.related('user'))
      .related('vote_entries', q => q.related('choices'))
      .related('support_votes', q => q.related('user'))
      .related('change_requests')
      .related('group')
      .limit(limit)
  ),

  searchableEvents: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.event
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('creator')
      .related('group')
      .related('participants', q => q.related('user'))
      .related('event_hashtags', q => q.related('hashtag'))
      .related('roles', q => q.related('holders'))
      .related('agenda_items', q => q.related('election').related('amendment'))
      .limit(limit)
  ),

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

  searchableTodos: defineQuery(z.object({ limit: z.number() }), ({ args: { limit } }) =>
    zql.todo
      .where('visibility', 'IN', ['public', 'authenticated'])
      .related('group')
      .related('creator')
      .related('assignments', q => q.related('user'))
      .limit(limit)
  ),

  searchableTodosByCreator: defineQuery(
    z.object({ user_id: z.string(), limit: z.number() }),
    ({ args: { user_id, limit } }) =>
      zql.todo
        .where('creator_id', user_id)
        .related('group')
        .related('creator')
        .related('assignments', q => q.related('user'))
        .limit(limit)
  ),

  searchableTodosByGroups: defineQuery(
    z.object({ group_ids: z.array(z.string()), limit: z.number() }),
    ({ args: { group_ids, limit } }) =>
      zql.todo
        .where('group_id', 'IN', group_ids)
        .related('group')
        .related('creator')
        .related('assignments', q => q.related('user'))
        .limit(limit)
  ),
};
