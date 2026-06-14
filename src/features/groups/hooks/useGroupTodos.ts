/**
 * Hook for managing group todos
 */

import { useState } from 'react';
import { useGroupTodos as useFacadeGroupTodos } from '@/zero/groups/useGroupState';
import { useTodoActions } from '@/zero/todos/useTodoActions';
import { toast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function useGroupTodos(groupId: string, userId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { todos: todosData, isLoading: isQuerying } = useFacadeGroupTodos(groupId);
  const {
    createTodo: createTodoAction,
    updateTodo: updateTodoAction,
    deleteTodo: deleteTodoAction,
    assignUser: assignUserAction,
  } = useTodoActions();

  const todos = todosData;

  const addTodo = async (todoData: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    assigneeUserIds?: string[];
    groupName?: string;
  }) => {
    if (!userId) {
      toast.error(translateText('generated.inline.0159_you_must_be_logged_in_702ab856'));
      return { success: false };
    }

    setIsLoading(true);
    try {
      const todoId = crypto.randomUUID();

      await createTodoAction({
        id: todoId,
        title: todoData.title,
        description: todoData.description,
        priority: todoData.priority,
        status: 'pending',
        due_date: todoData.dueDate ? new Date(todoData.dueDate).getTime() : 0,
        completed_at: 0,
        tags: [],
        visibility: 'group',
        group_id: groupId,
        event_id: null,
        amendment_id: null,
      });

      // Create assignment for creator
      const assignmentId = crypto.randomUUID();
      await assignUserAction({
        id: assignmentId,
        role: 'assignee',
        todo_id: todoId,
        user_id: userId,
      });

      toast.success(translateText('generated.inline.0579_todo_added_successfully_49ebeed5'));
      return { success: true, todoId };
    } catch (error) {
      console.error('Failed to add todo:', error);
      toast.error(translateText('generated.inline.0580_failed_to_add_todo_9a94c939'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const updateTodoStatus = async (
    todoId: string,
    newStatus: string,
    _senderId?: string,
    _groupName?: string,
    _assigneeUserIds?: string[]
  ) => {
    void _senderId;
    void _groupName;
    void _assigneeUserIds;

    setIsLoading(true);
    try {
      await updateTodoAction({
        id: todoId,
        status: newStatus,
        completed_at: newStatus === 'completed' ? Date.now() : undefined,
      });

      toast.success(translateText('generated.inline.0581_status_updated_78f091e0'));
      return { success: true };
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(translateText('generated.inline.0582_failed_to_update_status_5e3403e7'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTodoComplete = async (todo: { id: string; status: string | null }) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
    return updateTodoStatus(todo.id, newStatus);
  };

  const deleteTodo = async (
    todoId: string,
    _todoTitle?: string,
    _senderId?: string,
    _groupName?: string,
    _assigneeUserIds?: string[]
  ) => {
    void _todoTitle;
    void _senderId;
    void _groupName;
    void _assigneeUserIds;

    setIsLoading(true);
    try {
      await deleteTodoAction(todoId);

      toast.success(translateText('generated.inline.0583_todo_deleted_successfully_632e007b'));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete todo:', error);
      toast.error(translateText('generated.inline.0584_failed_to_delete_todo_34ca221d'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    todos,
    addTodo,
    updateTodoStatus,
    toggleTodoComplete,
    deleteTodo,
    isLoading: isLoading || isQuerying,
  };
}
