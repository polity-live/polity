import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { applyTodoQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

const todoStartSchema = z
  .object({
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
    due_date: z.number().optional(),
    id: z.string(),
  })
  .nullable();

export const todoQueries = {
  page: defineQuery(
    z.object({
      status: z.enum(['all', 'pending', 'in_progress', 'completed', 'cancelled']).default('all'),
      query: z.string().default(''),
      assigneeId: z.string().optional(),
      groupId: z.string().optional(),
      creatorId: z.string().optional(),
      priority: z.string().optional(),
      sort: z.enum(['created', 'updated', 'due']).default('created'),
      limit: virtualPageLimitSchema,
      start: todoStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({
      args: { status, query, assigneeId, groupId, creatorId, priority, sort, limit, start, dir },
      ctx: { userID },
    }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = applyTodoQueryAccess(zql.todo, userID)
        .where(({ or, cmp, exists }: any) =>
          or(
            cmp('creator_id', userID),
            exists('assignments', (assignment: any) => assignment.where('user_id', userID))
          )
        )
        .related('creator')
        .related('assignments', (assignment: any) => assignment.related('user'))
        .related('group')
        .related('event')
        .related('amendment');

      if (status !== 'all') q = q.where('status', status);
      if (assigneeId)
        q = q.whereExists('assignments', (assignment: any) =>
          assignment.where('user_id', assigneeId)
        );
      if (groupId) q = q.where('group_id', groupId);
      if (creatorId) q = q.where('creator_id', creatorId);
      if (priority) q = q.where('priority', priority);
      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        q = q.where(({ or, cmp }: any) =>
          or(
            cmp('title', 'ILIKE', `%${normalizedQuery}%`),
            cmp('description', 'ILIKE', `%${normalizedQuery}%`)
          )
        );
      }
      const sortField =
        sort === 'updated' ? 'updated_at' : sort === 'due' ? 'due_date' : 'created_at';
      q = q.orderBy(sortField, direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  // Todos created by or assigned to the current user
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyTodoQueryAccess(zql.todo, userID).where('creator_id', userID).orderBy('created_at', 'desc')
  ),

  // Todos for a specific group
  byGroup: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyTodoQueryAccess(zql.todo, userID)
        .where('group_id', group_id)
        .orderBy('created_at', 'desc')
  ),

  // Single todo by ID
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyTodoQueryAccess(zql.todo.where('id', id), userID).one()
  ),

  // Assignments for a todo
  assignments: defineQuery(
    z.object({ todo_id: z.string() }),
    ({ args: { todo_id }, ctx: { userID } }) =>
      zql.todo_assignment
        .where('todo_id', todo_id)
        .whereExists('todo', todo => applyTodoQueryAccess(todo, userID))
        .related('user')
  ),

  // Single todo by ID with full relations
  byIdWithRelations: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyTodoQueryAccess(zql.todo, userID)
        .where('id', id)
        .related('creator')
        .related('assignments', q => q.related('user'))
        .related('group')
        .related('event')
        .related('amendment')
        .one()
  ),

  // All todos with full relations (for client-side user filtering)
  allWithRelations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyTodoQueryAccess(zql.todo, userID)
      .related('creator')
      .related('assignments', q => q.related('user'))
      .related('group')
      .related('event')
      .related('amendment')
      .orderBy('created_at', 'desc')
  ),

  // Todos by group with full relations
  byGroupWithRelations: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyTodoQueryAccess(zql.todo, userID)
        .where('group_id', group_id)
        .related('creator')
        .related('assignments', q => q.related('user'))
        .related('group')
        .related('event')
        .related('amendment')
        .orderBy('created_at', 'desc')
  ),

  byGroupWithAssignments: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyTodoQueryAccess(zql.todo, userID)
        .where('group_id', group_id)
        .related('assignments', q => q.related('user'))
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type TodoRow = QueryRowType<typeof todoQueries.byId>;
export type TodoWithRelationsRow = QueryRowType<typeof todoQueries.allWithRelations>;
export type TodoByIdWithRelationsRow = QueryRowType<typeof todoQueries.byIdWithRelations>;
export type TodoByGroupWithRelationsRow = QueryRowType<typeof todoQueries.byGroupWithRelations>;
export type TodoByGroupWithAssignmentsRow = QueryRowType<typeof todoQueries.byGroupWithAssignments>;
export type TodoAssignmentRow = QueryRowType<typeof todoQueries.assignments>;
export type TodoPageRow = QueryRowType<typeof todoQueries.page>;
