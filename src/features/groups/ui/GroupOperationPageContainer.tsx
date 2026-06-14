import { useEffect } from 'react';

import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GroupDocumentsList } from '@/features/documents/ui/GroupDocumentsList';
import { useGroupOperationPage } from '@/features/groups/hooks/useGroupOperationPage';
import { hasGroupOperationAccess } from '@/features/groups/logic/hasGroupOperationAccess';
import { PaymentsSection } from '@/features/groups/ui/PaymentsSection';
import { TodosSection } from '@/features/groups/ui/TodosSection';
import { AddLinkDialog } from '@/features/network/ui/AddLinkDialog';
import { LinksSection } from '@/features/network/ui/LinksSection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '@/features/shared/ui/layout';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import type { Todo } from '@/features/todos/types/todo.types';
import { usePermissions } from '@/zero/rbac';

interface GroupOperationPageContainerProps {
  groupId: string;
  hash: string;
}

export function GroupOperationPageContainer({ groupId, hash }: GroupOperationPageContainerProps) {
  const { canManage, canView, isLoading, isMember } = usePermissions({ groupId });

  const canViewDocuments = canView('groupDocuments');
  const canViewLinks = canView('groupLinks');
  const canViewPayments = canView('groupPayments');
  const canViewTodos = canView('groupTodos');
  const canAccessOperation = hasGroupOperationAccess({
    canViewDocuments,
    canViewLinks,
    canViewPayments,
    canViewTodos,
  });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!isMember() || !canAccessOperation) {
    return <AccessDenied />;
  }

  return (
    <AuthorizedGroupOperationPage
      canManageDocuments={canManage('groupDocuments')}
      canManageLinks={canManage('groupLinks')}
      canManagePayments={canManage('groupPayments')}
      canManageTodos={canManage('groupTodos')}
      canViewDocuments={canViewDocuments}
      canViewLinks={canViewLinks}
      canViewPayments={canViewPayments}
      canViewTodos={canViewTodos}
      groupId={groupId}
      hash={hash}
    />
  );
}

interface AuthorizedGroupOperationPageProps {
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

function AuthorizedGroupOperationPage({
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

type GroupOperationPageState = ReturnType<typeof useGroupOperationPage>;

type GroupOperationPageViewProps = Omit<AuthorizedGroupOperationPageProps, 'hash'> & {
  userId: GroupOperationPageState['userId'];
  groupName: GroupOperationPageState['groupName'];
  links: GroupOperationPageState['links'];
  linkDialogOpen: GroupOperationPageState['linkDialogOpen'];
  onLinkDialogOpenChange: (open: boolean) => void;
  handleAddLink: GroupOperationPageState['handleAddLink'];
  payments: GroupOperationPageState['payments'];
  summary: GroupOperationPageState['summary'];
  incomeData: GroupOperationPageState['incomeData'];
  expenditureData: GroupOperationPageState['expenditureData'];
  todos: Todo[];
  todoViewMode: GroupOperationPageState['todoViewMode'];
  onTodoViewModeChange: GroupOperationPageState['setTodoViewMode'];
  onToggleTodoComplete: GroupOperationPageState['toggleTodoComplete'];
};

function GroupOperationPageView({
  canManageDocuments,
  canManageLinks,
  canManagePayments,
  canManageTodos,
  canViewDocuments,
  canViewLinks,
  canViewPayments,
  canViewTodos,
  groupId,
  userId,
  groupName,
  links,
  linkDialogOpen,
  onLinkDialogOpenChange,
  handleAddLink,
  payments,
  summary,
  incomeData,
  expenditureData,
  todos,
  todoViewMode,
  onTodoViewModeChange,
  onToggleTodoComplete,
}: GroupOperationPageViewProps) {
  return (
    <div className="space-y-8">
      {canViewLinks ? (
        <LinksSection
          links={links}
          addLinkButton={
            canManageLinks ? (
              <AddLinkDialog
                isOpen={linkDialogOpen}
                onOpenChange={onLinkDialogOpenChange}
                onSubmit={handleAddLink}
              />
            ) : null
          }
        />
      ) : null}

      {canViewPayments ? (
        <section id="payments" className="scroll-mt-24">
          <PaymentsSection
            canManagePayments={canManagePayments}
            groupId={groupId}
            storageKey={`group-${groupId}-payments`}
            payments={payments}
            summary={summary}
            incomeData={incomeData}
            expenditureData={expenditureData}
          />
        </section>
      ) : null}

      {canViewTodos ? (
        <section id="todos" className="scroll-mt-24">
          <TodosSection
            canManageTodos={canManageTodos}
            groupId={groupId}
            storageKey={`group-${groupId}-todos`}
            todos={todos}
            viewMode={todoViewMode}
            onViewModeChange={onTodoViewModeChange}
            onToggleComplete={onToggleTodoComplete}
          />
        </section>
      ) : null}

      {canViewDocuments ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>{translateText('generated.inline.1268_documents_687c8286')}</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <GroupDocumentsList
              groupId={groupId}
              groupName={groupName}
              userId={userId}
              storageKey={`group-${groupId}-documents`}
              canManageDocuments={canManageDocuments}
            />
          </PanelContent>
        </Panel>
      ) : null}
    </div>
  );
}
