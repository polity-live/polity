import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { groupName, userName } from '../server-helpers';
import {
  createTodoSchema,
  createTodoFullMutatorSchema,
  updateTodoSchema,
  deleteTodoSchema,
  toggleCompleteTodoSchema,
  archiveTodoSchema,
  unarchiveTodoSchema,
  createTodoAssignmentSchema,
} from './schema';

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const todoServerMutators = {
  create: defineMutator(createTodoSchema, async ({ tx, ctx, args }) => {
    await mutators.todos.create.fn({ tx, ctx, args });
  }),

  createFull: defineMutator(createTodoFullMutatorSchema, async ({ tx, ctx, args }) => {
    await todoServerMutators.create.fn({ tx, ctx, args: args.todo });

    if (args.assignment) {
      await todoServerMutators.assign.fn({ tx, ctx, args: args.assignment });
    }

    if (args.timeline_event) {
      await tx.mutate.timeline_event.insert({
        ...args.timeline_event,
        created_at: Date.now(),
      });
    }
  }),

  update: defineMutator(updateTodoSchema, async ({ tx, ctx, args }) => {
    const oldTodo = await tx.run(zql.todo.where('id', args.id).one());

    await mutators.todos.update.fn({ tx, ctx, args });

    if (!oldTodo) {
      return;
    }

    const todoTitle = args.title ?? oldTodo.title ?? 'Task';
    const assignments = await tx.run(zql.todo_assignment.where('todo_id', args.id));
    const otherAssigneeIds = assignments
      .map(assignment => assignment.user_id)
      .filter(assigneeId => assigneeId && assigneeId !== ctx.userID);

    if (oldTodo.group_id && otherAssigneeIds.length > 0) {
      const gName = await groupName(tx, oldTodo.group_id);
      for (const assigneeId of otherAssigneeIds) {
        fireNotification('notifyTodoUpdated', {
          senderId: ctx.userID,
          recipientUserId: assigneeId,
          groupId: oldTodo.group_id,
          groupName: gName,
          todoTitle,
        });
      }
    }

    if (
      args.status === 'completed' &&
      oldTodo.status !== 'completed' &&
      oldTodo.creator_id !== ctx.userID
    ) {
      const senderName = await userName(tx, ctx.userID);
      fireNotification('notifyTodoCompleted', {
        senderId: ctx.userID,
        senderName,
        recipientUserId: oldTodo.creator_id,
        todoTitle,
      });
    }
  }),

  delete: defineMutator(deleteTodoSchema, async ({ tx, ctx, args }) => {
    const [oldTodo, assignments] = await Promise.all([
      tx.run(zql.todo.where('id', args.id).one()),
      tx.run(zql.todo_assignment.where('todo_id', args.id)),
    ]);

    await mutators.todos.delete.fn({ tx, ctx, args });

    if (!oldTodo) {
      return;
    }

    const assigneeIds = assignments
      .map(assignment => assignment.user_id)
      .filter(assigneeId => assigneeId && assigneeId !== ctx.userID);
    if (assigneeIds.length === 0) {
      return;
    }

    const todoTitle = oldTodo.title ?? 'Task';

    if (oldTodo.group_id) {
      const gName = await groupName(tx, oldTodo.group_id);
      for (const assigneeId of assigneeIds) {
        fireNotification('notifyTodoDeleted', {
          senderId: ctx.userID,
          recipientUserId: assigneeId,
          groupId: oldTodo.group_id,
          groupName: gName,
          todoTitle,
        });
      }
      return;
    }

    const senderName = await userName(tx, ctx.userID);
    for (const assigneeId of assigneeIds) {
      fireNotification('notifyStandaloneTodoDeleted', {
        senderId: ctx.userID,
        senderName,
        recipientUserId: assigneeId,
        todoTitle,
      });
    }
  }),

  archive: defineMutator(archiveTodoSchema, async ({ tx, ctx, args }) => {
    await mutators.todos.archive.fn({ tx, ctx, args });
  }),

  unarchive: defineMutator(unarchiveTodoSchema, async ({ tx, ctx, args }) => {
    await mutators.todos.unarchive.fn({ tx, ctx, args });
  }),

  assign: defineMutator(createTodoAssignmentSchema, async ({ tx, ctx, args }) => {
    await mutators.todos.assign.fn({ tx, ctx, args });

    const todo = await tx.run(zql.todo.where('id', args.todo_id).one());
    if (!todo) {
      return;
    }

    const todoTitle = todo.title ?? 'Task';

    if (args.user_id === ctx.userID) {
      if (todo.creator_id && todo.creator_id !== ctx.userID) {
        await fireNotification('notifyTodoClaimed', {
          senderId: ctx.userID,
          senderName: await userName(tx, ctx.userID),
          recipientUserId: todo.creator_id,
          todoId: todo.id,
          todoTitle,
        });
      }
      return;
    }

    if (todo.group_id) {
      const gName = await groupName(tx, todo.group_id);
      fireNotification('notifyTodoAssigned', {
        senderId: ctx.userID,
        recipientUserId: args.user_id,
        groupId: todo.group_id,
        groupName: gName,
        todoTitle,
      });
      return;
    }

    fireNotification('notifyStandaloneTodoAssigned', {
      senderId: ctx.userID,
      recipientUserId: args.user_id,
      todoId: todo.id,
      todoTitle,
    });
  }),

  toggleComplete: defineMutator(toggleCompleteTodoSchema, async ({ tx, ctx, args }) => {
    const existingTodo = await tx.run(zql.todo.where('id', args.id).one());

    await mutators.todos.toggleComplete.fn({ tx, ctx, args });

    if (!existingTodo) {
      return;
    }

    const assignments = await tx.run(zql.todo_assignment.where('todo_id', args.id));
    const assigneeIds = assignments
      .map(assignment => assignment.user_id)
      .filter(assigneeId => assigneeId && assigneeId !== ctx.userID);
    const isCompleting = existingTodo.status !== 'completed';
    const todoTitle = existingTodo.title ?? 'Task';

    if (existingTodo.group_id && assigneeIds.length > 0) {
      const gName = await groupName(tx, existingTodo.group_id);
      for (const assigneeId of assigneeIds) {
        fireNotification('notifyTodoUpdated', {
          senderId: ctx.userID,
          recipientUserId: assigneeId,
          groupId: existingTodo.group_id,
          groupName: gName,
          todoTitle,
        });
      }
    }

    if (isCompleting && existingTodo.creator_id !== ctx.userID) {
      const senderName = await userName(tx, ctx.userID);
      fireNotification('notifyTodoCompleted', {
        senderId: ctx.userID,
        senderName,
        recipientUserId: existingTodo.creator_id,
        todoTitle,
      });
    }
  }),
};
