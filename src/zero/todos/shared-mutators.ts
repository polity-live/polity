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
import type { TodoActivityChange } from './table';
import type { MutableJSONValue } from '../shared/helpers';

const TRACKED_UPDATE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'due_date',
  'tags',
  'visibility',
] as const;

type TodoActivityAction =
  'created' | 'updated' | 'assigned' | 'unassigned' | 'archived' | 'unarchived';

function normalizeActivityValue(value: unknown) {
  return value === undefined ? null : value;
}

function activityValuesEqual(left: unknown, right: unknown) {
  return (
    JSON.stringify(normalizeActivityValue(left)) === JSON.stringify(normalizeActivityValue(right))
  );
}

async function appendTodoActivity(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  args: {
    todoId: string;
    action: TodoActivityAction;
    severity: 'normal' | 'high';
    changes?: TodoActivityChange[];
    subjectUserId?: string | null;
    createdAt?: number;
    id?: string;
  }
) {
  if (tx.location === 'client') return;

  await tx.mutate.todo_activity.insert({
    id: args.id ?? crypto.randomUUID(),
    todo_id: args.todoId,
    actor_id: ctx.userID,
    subject_user_id: args.subjectUserId ?? null,
    action: args.action,
    severity: args.severity,
    changes: (args.changes ?? []) as unknown as MutableJSONValue,
    created_at: args.createdAt ?? Date.now(),
  });
}

async function loadAssigneeIds(tx: Parameters<typeof can>[0], todoId: string) {
  const assignments = await tx.run(zql.todo_assignment.where('todo_id', todoId));
  return assignments
    .map(assignment => assignment.user_id)
    .filter(Boolean)
    .sort();
}

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

    await appendTodoActivity(tx, ctx, {
      id: args.id,
      todoId: args.id,
      action: 'created',
      severity: 'high',
      createdAt: now,
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
    const changes: TodoActivityChange[] = TRACKED_UPDATE_FIELDS.flatMap(field => {
      if (!Object.prototype.hasOwnProperty.call(fields, field)) return [];
      const from = normalizeActivityValue(existing[field]);
      const to = normalizeActivityValue(fields[field]);
      return activityValuesEqual(from, to) ? [] : [{ field, from, to }];
    });
    const automaticallyUnarchives = Boolean(
      existing.archived_at && fields.status && fields.status !== 'completed'
    );
    if (automaticallyUnarchives) {
      changes.push({ field: 'archive_state', from: 'archived', to: 'active' });
    }

    await tx.mutate.todo.update({
      id,
      ...fields,
      ...(automaticallyUnarchives ? { archived_at: null } : {}),
      updated_at: Date.now(),
    });

    if (changes.length > 0) {
      await appendTodoActivity(tx, ctx, {
        todoId: id,
        action: 'updated',
        severity: changes.some(
          change => change.field === 'status' || change.field === 'archive_state'
        )
          ? 'high'
          : 'normal',
        changes,
      });
    }
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
    await appendTodoActivity(tx, ctx, {
      todoId: args.id,
      action: 'archived',
      severity: 'high',
      changes: [{ field: 'archive_state', from: 'active', to: 'archived' }],
      createdAt: now,
    });
  }),

  unarchive: defineMutator(unarchiveTodoSchema, async ({ tx, ctx, args }) => {
    const existing = await loadTodo(tx, args.id);
    await authorizeTodoOwnerOrGroupManage(tx, ctx, args.id, 'manage');

    if (!existing.archived_at) {
      return;
    }

    const now = Date.now();
    await tx.mutate.todo.update({ id: args.id, archived_at: null, updated_at: now });
    await appendTodoActivity(tx, ctx, {
      todoId: args.id,
      action: 'unarchived',
      severity: 'high',
      changes: [{ field: 'archive_state', from: 'archived', to: 'active' }],
      createdAt: now,
    });
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
    const previousAssigneeIds =
      tx.location === 'client' ? [] : await loadAssigneeIds(tx, args.todo_id);
    await tx.mutate.todo_assignment.insert({
      ...args,
      assigned_at: now,
    });
    await appendTodoActivity(tx, ctx, {
      todoId: args.todo_id,
      action: 'assigned',
      severity: 'high',
      subjectUserId: args.user_id,
      changes: [
        {
          field: 'assignees',
          from: previousAssigneeIds,
          to: [...previousAssigneeIds, args.user_id].sort(),
        },
      ],
      createdAt: now,
    });
  }),

  // Unassign a user from a todo
  unassign: defineMutator(deleteTodoAssignmentSchema, async ({ tx, ctx, args }) => {
    let assignment: { todo_id: string; user_id: string } | undefined;
    let previousAssigneeIds: string[] = [];
    if (tx.location !== 'client') {
      assignment = await tx.run(zql.todo_assignment.where('id', args.id).one());
      if (!assignment) {
        throw new Error('Todo assignment not found');
      }

      await authorizeTodoOwnerOrGroupManage(tx, ctx, assignment.todo_id, 'manage');
      previousAssigneeIds = await loadAssigneeIds(tx, assignment.todo_id);
    }

    await tx.mutate.todo_assignment.delete({ id: args.id });
    if (assignment) {
      const todoId = assignment.todo_id;
      const userId = assignment.user_id;
      await appendTodoActivity(tx, ctx, {
        todoId,
        action: 'unassigned',
        severity: 'high',
        subjectUserId: userId,
        changes: [
          {
            field: 'assignees',
            from: previousAssigneeIds,
            to: previousAssigneeIds.filter(id => id !== userId),
          },
        ],
      });
    }
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
    await appendTodoActivity(tx, ctx, {
      todoId: args.id,
      action: 'updated',
      severity: 'high',
      changes: [
        {
          field: 'status',
          from: existing.status,
          to: isCompleting ? 'completed' : 'open',
        },
      ],
      createdAt: now,
    });
  }),
};
