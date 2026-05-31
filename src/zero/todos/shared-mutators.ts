import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { zql } from '../schema';
import {
  createTodoSchema,
  updateTodoSchema,
  deleteTodoSchema,
  toggleCompleteTodoSchema,
  createTodoAssignmentSchema,
  deleteTodoAssignmentSchema,
} from './schema';

async function authorizeGroupTodoManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupId: string | null | undefined
) {
  if (!groupId) {
    return;
  }

  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupTodos',
    groupId,
  });
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const todoSharedMutators = {
  // Create a todo
  create: defineMutator(createTodoSchema, async ({ tx, ctx, args }) => {
    await authorizeGroupTodoManage(tx, ctx, args.group_id);

    const now = Date.now();
    await tx.mutate.todo.insert({
      ...args,
      creator_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });
  }),

  // Update a todo
  update: defineMutator(updateTodoSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const existingTodo = await tx.run(zql.todo.where('id', args.id).one());
      if (!existingTodo) {
        throw new Error('Todo not found');
      }

      await authorizeGroupTodoManage(tx, ctx, existingTodo.group_id);
    }

    const { id, ...fields } = args;
    await tx.mutate.todo.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  // Delete a todo
  delete: defineMutator(deleteTodoSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const existingTodo = await tx.run(zql.todo.where('id', args.id).one());
      if (!existingTodo) {
        throw new Error('Todo not found');
      }

      await authorizeGroupTodoManage(tx, ctx, existingTodo.group_id);
    }

    await tx.mutate.todo.delete({ id: args.id });
  }),

  // Assign a user to a todo
  assign: defineMutator(createTodoAssignmentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const existingTodo = await tx.run(zql.todo.where('id', args.todo_id).one());
      if (!existingTodo) {
        throw new Error('Todo not found');
      }

      await authorizeGroupTodoManage(tx, ctx, existingTodo.group_id);
    }

    const now = Date.now();
    await tx.mutate.todo_assignment.insert({
      ...args,
      assigned_at: now,
    });
  }),

  // Unassign a user from a todo
  unassign: defineMutator(deleteTodoAssignmentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const assignment = await tx.run(zql.todo_assignment.where('id', args.id).one());
      if (!assignment) {
        throw new Error('Todo assignment not found');
      }

      const existingTodo = await tx.run(zql.todo.where('id', assignment.todo_id).one());
      if (!existingTodo) {
        throw new Error('Todo not found');
      }

      await authorizeGroupTodoManage(tx, ctx, existingTodo.group_id);
    }

    await tx.mutate.todo_assignment.delete({ id: args.id });
  }),

  // Toggle todo completion
  toggleComplete: defineMutator(toggleCompleteTodoSchema, async ({ tx, ctx, args }) => {
    const existing = await tx.run(zql.todo.where('id', args.id).one());

    if (!existing) {
      throw new Error('Todo not found');
    }

    await authorizeGroupTodoManage(tx, ctx, existing.group_id);

    const now = Date.now();
    const isCompleting = existing.status !== 'completed';

    await tx.mutate.todo.update({
      id: args.id,
      status: isCompleting ? 'completed' : 'open',
      completed_at: isCompleting ? now : 0,
      updated_at: now,
    });
  }),
};
