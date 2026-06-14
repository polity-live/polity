import { useEffect } from 'react';

import { useGroupOperationPage } from '@/features/groups/hooks/useGroupOperationPage';
import type { Todo } from '@/features/todos/types/todo.types';

import { GroupOperationPageView } from './GroupOperationPageContainerView';

export interface AuthorizedGroupOperationPageProps {
  canManageDocuments: boolean;
  canManageLinks: boolean;
  canManagePayments: boolean;
  canManageTodos: boolean;
  canViewDocuments: boolean;
  canViewLinks: boolean;
  canViewPayments: boolean;
  canViewTodos: boolean;
  groupId: string;
  hash: string;
}

export function AuthorizedGroupOperationPage({
  canManageDocuments,
  canManageLinks,
  canManagePayments,
  canManageTodos,
  canViewDocuments,
  canViewLinks,
  canViewPayments,
  canViewTodos,
  groupId,
  hash,
}: AuthorizedGroupOperationPageProps) {
  const {
    userId,
    groupName,
    links,
    linkDialogOpen,
    setLinkDialogOpen,
    handleAddLink,
    payments,
    summary,
    incomeData,
    expenditureData,
    todos,
    todoViewMode,
    setTodoViewMode,
    toggleTodoComplete,
  } = useGroupOperationPage(groupId);

  useEffect(() => {
    if (!hash) {
      return;
    }

    const sectionId = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!sectionId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <GroupOperationPageView
      canManageDocuments={canManageDocuments}
      canManageLinks={canManageLinks}
      canManagePayments={canManagePayments}
      canManageTodos={canManageTodos}
      canViewDocuments={canViewDocuments}
      canViewLinks={canViewLinks}
      canViewPayments={canViewPayments}
      canViewTodos={canViewTodos}
      expenditureData={expenditureData}
      groupId={groupId}
      groupName={groupName}
      handleAddLink={handleAddLink}
      incomeData={incomeData}
      linkDialogOpen={linkDialogOpen}
      links={links}
      onLinkDialogOpenChange={setLinkDialogOpen}
      onTodoViewModeChange={setTodoViewMode}
      onToggleTodoComplete={toggleTodoComplete}
      payments={payments}
      summary={summary}
      todoViewMode={todoViewMode}
      todos={todos as Todo[]}
      userId={userId}
    />
  );
}
