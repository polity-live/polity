'use client';
import { useState } from 'react';
import { useGroupState } from '@/zero/groups/useGroupState.ts';
import { useTodoActions } from '@/zero/todos/useTodoActions.ts';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { Todo } from '../types/todo.types';

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
type TodoVisibility = 'public' | 'authenticated' | 'private';

interface TodoFormData {
  title: string;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string;
  tags: string[];
  visibility: TodoVisibility;
}

interface TodoDetailDialogProps {
  canManageTodos?: boolean;
  todo: Todo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getSelectedUserIds(todo: Todo): string[] {
  return (
    todo.assignments
      ?.map(assignment => assignment.user?.id)
      .filter((id): id is string => Boolean(id)) || []
  );
}

function getInitialFormData(todo: Todo): TodoFormData {
  return {
    title: todo.title || '',
    description: todo.description || '',
    status: (todo.status || 'pending') as TodoStatus,
    priority: (todo.priority || 'medium') as TodoPriority,
    dueDate: todo.due_date ? new Date(todo.due_date).toISOString().split('T')[0] : '',
    tags: todo.tags || [],
    visibility: (todo.visibility || 'private') as TodoVisibility,
  };
}
import { TodoDetailDialogView } from './TodoDetailDialogView';
export function TodoDetailDialog({
  canManageTodos = true,
  todo,
  open,
  onOpenChange,
}: TodoDetailDialogProps) {
  const { t } = useTranslation();
  const { updateTodo, assignUser, unassignUser } = useTodoActions();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => getSelectedUserIds(todo));
  const [formData, setFormData] = useState<TodoFormData>(() => getInitialFormData(todo));

  const isOverdue = todo.due_date && todo.status !== 'completed' && todo.due_date < Date.now();
  const visibilityLabels: Record<TodoVisibility, string> = {
    public: t('common.visibility.public'),
    authenticated: t('common.visibility.authenticated'),
    private: t('common.visibility.private'),
  };

  // Query group members if the todo belongs to a group
  const { membershipsWithUsers: membershipsRaw } = useGroupState(
    todo.group?.id ? { groupId: todo.group.id, includeMembershipsWithUsers: true } : {}
  );

  const members = membershipsRaw || [];

  // Filter members based on search query
  const filteredMembers = members.filter(membership => {
    const user = membership.user;
    if (!user?.id) return false;
    const query = searchQuery.toLowerCase();
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return (
      displayName.toLowerCase().includes(query) ||
      user.handle?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const resetForm = () => {
    setFormData(getInitialFormData(todo));
    setSelectedUserIds(getSelectedUserIds(todo));
    setSearchQuery('');
    setPopoverOpen(false);
    setIsEditing(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!canManageTodos) {
      return;
    }

    setIsSaving(true);
    try {
      const updates: Omit<Parameters<typeof updateTodo>[0], 'id'> = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.dueDate ? new Date(formData.dueDate).getTime() : null,
        tags: formData.tags,
        visibility: formData.visibility,
      };

      if (formData.status === 'completed' && todo.status !== 'completed') {
        updates.completed_at = Date.now();
      } else if (formData.status !== 'completed' && todo.status === 'completed') {
        updates.completed_at = null;
      }

      // Update todo
      await waitForClientApply(updateTodo({ id: todo.id, ...updates }));

      // Handle assignment changes
      const currentAssignmentIds =
        todo.assignments?.map(a => a.user?.id).filter((x): x is string => Boolean(x)) || [];
      const addedUserIds = selectedUserIds.filter(id => !currentAssignmentIds.includes(id));
      const removedAssignments =
        todo.assignments?.filter(a => a.user?.id && !selectedUserIds.includes(a.user.id)) || [];

      // Remove old assignments
      for (const assignment of removedAssignments) {
        await waitForClientApply(unassignUser(assignment.id));
      }

      // Add new assignments
      for (const userId of addedUserIds) {
        const assignmentId = crypto.randomUUID();
        await waitForClientApply(
          assignUser({
            id: assignmentId,
            todo_id: todo.id,
            user_id: userId,
            role: 'assignee',
          })
        );
      }

      // Mutations already executed above
      toast.success(t('features.todos.notifications.todoUpdated'));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update todo:', error);
      toast.error(t('features.todos.notifications.todoUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleRemoveAssignee = (userId: string) => {
    setSelectedUserIds(prev => prev.filter(id => id !== userId));
  };

  const handleAddAssignee = (userId: string) => {
    if (!selectedUserIds.includes(userId)) {
      setSelectedUserIds(prev => [...prev, userId]);
    }
    setPopoverOpen(false);
    setSearchQuery('');
  };
  return (
    <TodoDetailDialogView
      canManageTodos={canManageTodos}
      todo={todo}
      open={open}
      onOpenChange={onOpenChange}
      t={t}
      updateTodo={updateTodo}
      assignUser={assignUser}
      unassignUser={unassignUser}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      isSaving={isSaving}
      setIsSaving={setIsSaving}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      popoverOpen={popoverOpen}
      setPopoverOpen={setPopoverOpen}
      selectedUserIds={selectedUserIds}
      setSelectedUserIds={setSelectedUserIds}
      formData={formData}
      setFormData={setFormData}
      isOverdue={isOverdue}
      visibilityLabels={visibilityLabels}
      membershipsRaw={membershipsRaw}
      members={members}
      filteredMembers={filteredMembers}
      resetForm={resetForm}
      handleDialogOpenChange={handleDialogOpenChange}
      handleSave={handleSave}
      handleCancel={handleCancel}
      handleRemoveAssignee={handleRemoveAssignee}
      handleAddAssignee={handleAddAssignee}
    />
  );
}
