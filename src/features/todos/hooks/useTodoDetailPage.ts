import { useState, useEffect } from 'react';
import { useTodoState } from '@/zero/todos/useTodoState';
import { useTodoMutations } from './useTodoMutations';
import { TodoFormData, TodoStatus, TodoPriority } from '../types/todo.types';
import { useAuth } from '@/providers/auth-provider';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import { resolveTodoDeadlineTimestamp, todoDeadlineToFormValues } from '../utils/todoFormatters';
import { useTodoDiscussion } from './useTodoDiscussion';
import { usePermissions } from '@/zero/rbac';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { useTodoActions } from '@/zero/todos/useTodoActions';
import { reportAppTutorialAction } from '@/features/app-tutorial/events';
import { useTodoActivity } from './useTodoActivity';

export function useTodoDetailPage(todoId: string) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const { updateTodo } = useTodoMutations();
  const { archiveTodo, unarchiveTodo } = useTodoActions();
  const { user } = useAuth();

  const { todo, assignments } = useTodoState({ todoId });
  const discussion = useTodoDiscussion(todo);
  const activity = useTodoActivity(todo);
  const { canManage } = usePermissions({ groupId: todo?.group_id ?? undefined });

  // Visibility access check: creator or assignee can access private todos
  const isCreatorOrAssignee =
    !!user?.id &&
    (todo?.creator_id === user.id || (assignments ?? []).some(a => a.user_id === user.id));
  const canAccess = checkEntityAccess(todo?.visibility, !!user?.id, isCreatorOrAssignee);
  const canManageTodos = Boolean(
    user?.id && (todo?.group_id ? canManage('groupTodos') : todo?.creator_id === user.id)
  );

  const [formData, setFormData] = useState<TodoFormData>({
    title: todo?.title || '',
    description: todo?.description || '',
    status: (todo?.status || 'pending') as TodoStatus,
    priority: (todo?.priority || 'medium') as TodoPriority,
    ...todoDeadlineToFormValues(todo?.due_date),
  });

  useEffect(() => {
    if (todo) {
      setFormData({
        title: todo.title || '',
        description: todo.description || '',
        status: (todo.status || 'pending') as TodoStatus,
        priority: (todo.priority || 'medium') as TodoPriority,
        ...todoDeadlineToFormValues(todo.due_date),
      });
    }
  }, [todo]);

  const handleSave = async () => {
    if (!todo) return;

    setIsSaving(true);
    const updates: Parameters<typeof updateTodo>[1] = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      due_date: resolveTodoDeadlineTimestamp(todo.due_date, formData.dueDate, formData.dueTime),
    };

    if (formData.status === 'completed' && todo.status !== 'completed') {
      updates.completed_at = Date.now();
    } else if (formData.status !== 'completed' && todo.status === 'completed') {
      updates.completed_at = null;
    }

    const result = await updateTodo(todo.id, updates);
    if (result.success) {
      if (todo.tutorial_run_id && formData.status === 'completed') {
        reportAppTutorialAction({ type: 'mutation', event: 'todo.completed' });
      }
      if (todo.tutorial_run_id && formData.status === 'in_progress') {
        reportAppTutorialAction({ type: 'mutation', event: 'todo.in-progress' });
      }
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    if (!todo) return;
    setFormData({
      title: todo.title || '',
      description: todo.description || '',
      status: (todo.status || 'pending') as TodoStatus,
      priority: (todo.priority || 'medium') as TodoPriority,
      ...todoDeadlineToFormValues(todo.due_date),
    });
    setIsEditing(false);
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({ ...prev, title }));
  };

  const handleFormUpdate = (updates: Partial<TodoFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleArchive = async () => {
    if (!todo || !canManageTodos || todo.status !== 'completed') return;
    setIsArchiving(true);
    try {
      await waitForClientApply(archiveTodo(todo.id));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!todo || !canManageTodos) return;
    setIsArchiving(true);
    try {
      await waitForClientApply(unarchiveTodo(todo.id));
    } finally {
      setIsArchiving(false);
    }
  };

  return {
    todo,
    canAccess,
    isEditing,
    isSaving,
    formData,
    setIsEditing,
    handleSave,
    handleCancel,
    handleTitleChange,
    handleFormUpdate,
    discussion,
    activity,
    canManageTodos,
    isArchiving,
    handleArchive,
    handleUnarchive,
  };
}
