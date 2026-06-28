import { useState } from 'react';
import { useTodoActions } from '@/zero/todos/useTodoActions';
import { useCommonActions } from '@/zero/common';
import type { TodoUpdateInput } from '@/zero/todos/schema';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/**
 * Orchestration hook for todo mutations.
 * Composes facade actions (todo, common, notification) — no direct Zero usage.
 */
export function useTodoMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const todoActions = useTodoActions();
  const commonActions = useCommonActions();

  const createTodo = async (todoData: {
    id?: string;
    title: string;
    description?: string;
    ownerId: string;
    assigneeId?: string;
    status?: string;
    priority?: string;
    dueDate?: number;
    tags?: string[];
    groupId?: string;
    eventId?: string;
    amendmentId?: string;
    senderId?: string;
    visibility?: 'public' | 'authenticated' | 'private' | 'group';
  }) => {
    setIsLoading(true);
    try {
      const todoId = todoData.id ?? crypto.randomUUID();
      const payload = {
        todo: {
          id: todoId,
          title: todoData.title,
          description: todoData.description ?? '',
          status: todoData.status || 'open',
          priority: todoData.priority || 'medium',
          due_date: todoData.dueDate ?? 0,
          completed_at: 0,
          tags: todoData.tags ?? [],
          visibility: todoData.visibility || 'private',
          group_id: todoData.groupId ?? null,
          event_id: todoData.eventId ?? null,
          amendment_id: todoData.amendmentId ?? null,
        },
        assignment: todoData.assigneeId
          ? {
              id: crypto.randomUUID(),
              todo_id: todoId,
              user_id: todoData.assigneeId,
              role: 'assignee',
            }
          : null,
        timeline_event:
          todoData.visibility === 'public'
            ? {
                id: crypto.randomUUID(),
                event_type: 'todo_created',
                entity_type: 'todo',
                entity_id: todoId,
                actor_id: todoData.ownerId,
                title: translateText('generated.inline.0542_new_task_title_67129685', {
                  title: todoData.title,
                }),
                description: todoData.description?.substring(0, 100) ?? '',
                metadata: null,
                image_url: '',
                video_url: '',
                video_thumbnail_url: '',
                content_type: 'todo',
                tags: null,
                stats: null,
                vote_status: '',
                election_status: '',
                ends_at: 0,
                user_id: null,
                group_id: todoData.groupId ?? '',
                amendment_id: todoData.amendmentId ?? '',
                event_id: todoData.eventId ?? '',
                todo_id: todoId,
                blog_id: null,
                statement_id: null,
                election_id: null,
                amendment_vote_id: null,
              }
            : null,
      };

      const mutationResult = todoActions.createFullTodo(payload);
      await mutationResult.client;

      return { success: true, todoId, mutationResult, payload };
    } catch (error) {
      console.error('Failed to create todo:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const updateTodo = async (
    todoId: string,
    updates: Omit<TodoUpdateInput, 'id'>,
    options?: {
      senderId?: string;
      senderName?: string;
      creatorId?: string;
      todoTitle?: string;
      visibility?: 'public' | 'authenticated' | 'private';
    }
  ) => {
    setIsLoading(true);
    try {
      await todoActions.updateTodo({ id: todoId, ...updates });

      if (updates.status === 'completed' && options?.visibility === 'public' && options?.senderId) {
        await commonActions.createTimelineEvent({
          id: crypto.randomUUID(),
          event_type: 'status_changed',
          entity_type: 'todo',
          entity_id: todoId,
          actor_id: options.senderId,
          title: translateText('generated.inline.0543_task_completed_value1131_41e5a93d', {
            value1131: options.todoTitle || 'Task',
          }),
          description: translateText(
            'generated.inline.0544_a_task_has_been_marked_as_completed_89df782a'
          ),
          metadata: null,
          image_url: '',
          video_url: '',
          video_thumbnail_url: '',
          content_type: 'todo',
          tags: null,
          stats: null,
          vote_status: '',
          election_status: '',
          ends_at: 0,
          user_id: null,
          group_id: null,
          amendment_id: null,
          event_id: null,
          todo_id: todoId,
          blog_id: null,
          statement_id: null,
          election_id: null,
          amendment_vote_id: null,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update todo:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTodo = async (
    todoId: string,
    _params?: {
      senderId?: string;
      senderName?: string;
      todoTitle?: string;
      assigneeUserIds?: string[];
    }
  ) => {
    void _params;

    setIsLoading(true);
    try {
      await todoActions.deleteTodo(todoId);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete todo:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createTodo,
    updateTodo,
    deleteTodo,
    isLoading,
  };
}
