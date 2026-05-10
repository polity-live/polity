import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useGroupById } from '@/zero/groups/useGroupState';
import { useGroupLinks } from '@/features/network/hooks/useGroupLinks';
import { useGroupPayments } from './useGroupPayments';
import { useFinancialData } from './useFinancialData';
import { useGroupTodos } from './useGroupTodos';
import type { TodoViewMode } from '../types/group.types';

export function useGroupOperationPage(groupId: string) {
  const { user } = useAuth();
  const { group } = useGroupById(groupId);

  // Dialog open states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  // Todo view mode
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>('kanban');

  // Data
  const { links, addLink } = useGroupLinks(groupId);
  const { payments } = useGroupPayments(groupId);
  const { summary, incomeData, expenditureData } = useFinancialData(payments, groupId);
  const { todos, toggleTodoComplete } = useGroupTodos(groupId, user?.id);

  const groupName = group?.name ?? '';

  const handleAddLink = async (data: { label: string; url: string }) => {
    await addLink(data.label, data.url, user?.id);
    setLinkDialogOpen(false);
  };

  return {
    userId: user?.id,
    groupName,
    // Links
    links,
    linkDialogOpen,
    setLinkDialogOpen,
    handleAddLink,
    // Payments
    payments,
    summary,
    incomeData,
    expenditureData,
    // Todos
    todos,
    todoViewMode,
    setTodoViewMode,
    toggleTodoComplete,
  };
}
