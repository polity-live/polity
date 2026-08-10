import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';
import { zql } from '../schema';
import {
  createTodoSchema,
  createTodoFullMutatorSchema,
  updateTodoSchema,
  deleteTodoSchema,
  toggleCompleteTodoSchema,
  archiveTodoSchema,
  unarchiveTodoSchema,
  createTodoAssignmentSchema,
  deleteTodoAssignmentSchema,
} from './schema';

async function authorizeGroupTodoManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupId: string
) {
  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupTodos',
    groupId,
  });
}

async function loadTodo(tx: Parameters<typeof can>[0], todoId: string) {
  const todo = await tx.run(zql.todo.where('id', todoId).one());
  if (!todo) {
    throw new Error('Todo not found');
  }

  return todo;
}

async function authorizeTodoOwnerOrGroupManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  todoId: string,
  action: 'update' | 'delete' | 'manage'
) {
  if (tx.location === 'client') return;

  const todo = await loadTodo(tx, todoId);
  if (todo.group_id) {
    await authorizeGroupTodoManage(tx, ctx, todo.group_id);
    return;
  }

  requireOwner(tx, ctx, todo.creator_id, { action, resource: 'todos' });
}

async function authorizeTodoCompletion(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  todo: NonNullable<Awaited<ReturnType<typeof loadTodo>>>
) {
  if (tx.location === 'client') return;

  if (todo.group_id) {
    await authorizeGroupTodoManage(tx, ctx, todo.group_id);
    return;
  }

  requireAuthenticated(tx, ctx, { action: 'update', resource: 'todos' });
  if (todo.creator_id === ctx.userID) {
    return;
  }

  const assignment = await tx.run(
    zql.todo_assignment.where('todo_id', todo.id).where('user_id', ctx.userID).one()
  );
  if (!assignment) {
    throw new PermissionError('update', 'todos', `todo:${todo.id}`);
  }
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const todoSharedMutators = {
  // Create a todo
  create: defineMutator(createTodoSchema, async ({ tx, ctx, args }) => {
    if (args.group_id) {
      await authorizeGroupTodoManage(tx, ctx, args.group_id);
    } else {
      requireAuthenticated(tx, ctx, { action: 'create', resource: 'todos' });
    }

    const now = Date.now();
    await tx.mutate.todo.insert({
      ...args,
      archived_at: null,
      creator_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });

    if (tx.location === 'client') {
      await tx.mutate.thread.insert({
        id: args.id,
        todo_id: args.id,
        user_id: ctx.userID,
        status: 'open',
        upvotes: 0,
        downvotes: 0,
        created_at: now,
        updated_at: now,
      });
    }
  }),

  createFull: defineMutator(createTodoFullMutatorSchema, async ({ tx, ctx, args }) => {
    await todoSharedMutators.create.fn({ tx, ctx, args: args.todo });
  }),

  // Update a todo
  update: defineMutator(updateTodoSchema, async ({ tx, ctx, args }) => {
    await authorizeTodoOwnerOrGroupManage(tx, ctx, args.id, 'update');

    const { id, ...fields } = args;
    const existing = await loadTodo(tx, id);
    await tx.mutate.todo.update({
      id,
      ...fields,
      ...(existing.archived_at && fields.status && fields.status !== 'completed'
        ? { archived_at: null }
        : {}),
      updated_at: Date.now(),
    });
  }),

  archive: defineMutator(archiveTodoSchema, async ({ tx, ctx, args }) => {
    const existing = await loadTodo(tx, args.id);
    await authorizeTodoOwnerOrGroupManage(tx, ctx, args.id, 'manage');

    if (existing.status !== 'completed') {
      throw new Error('Only completed todos can be archived');
    }

    if (existing.archived_at) {
      return;
    }

    const now = Date.now();
    await tx.mutate.todo.update({ id: args.id, archived_at: now, updated_at: now });
  }),

  unarchive: defineMutator(unarchiveTodoSchema, async ({ tx, ctx, args }) => {
    const existing = await loadTodo(tx, args.id);
    await authorizeTodoOwnerOrGroupManage(tx, ctx, args.id, 'manage');

    if (!existing.archived_at) {
      return;
    }

    await tx.mutate.todo.update({ id: args.id, archived_at: null, updated_at: Date.now() });
  }),

  // Delete a todo
  delete: defineMutator(deleteTodoSchema, async ({ tx, ctx, args }) => {
    await authorizeTodoOwnerOrGroupManage(tx, ctx, args.id, 'delete');

    await tx.mutate.todo.delete({ id: args.id });
  }),

  // Assign a user to a todo
  assign: defineMutator(createTodoAssignmentSchema, async ({ tx, ctx, args }) => {
    await authorizeTodoOwnerOrGroupManage(tx, ctx, args.todo_id, 'manage');

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

      await authorizeTodoOwnerOrGroupManage(tx, ctx, assignment.todo_id, 'manage');
    }

    await tx.mutate.todo_assignment.delete({ id: args.id });
  }),

  // Toggle todo completion
  toggleComplete: defineMutator(toggleCompleteTodoSchema, async ({ tx, ctx, args }) => {
    const existing = await tx.run(zql.todo.where('id', args.id).one());

    if (!existing) {
      throw new Error('Todo not found');
    }

    await authorizeTodoCompletion(tx, ctx, existing);

    const now = Date.now();
    const isCompleting = existing.status !== 'completed';

    await tx.mutate.todo.update({
      id: args.id,
      status: isCompleting ? 'completed' : 'open',
      completed_at: isCompleting ? now : 0,
      archived_at: null,
      updated_at: now,
    });
  }),
};
