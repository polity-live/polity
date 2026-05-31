import { useEffect } from 'react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { useGroupOperationPage } from '@/features/groups/hooks/useGroupOperationPage';
import { hasGroupOperationAccess } from '@/features/groups/logic/hasGroupOperationAccess';
import { LinksSection } from '@/features/network/ui/LinksSection';
import { AddLinkDialog } from '@/features/network/ui/AddLinkDialog';
import { PaymentsSection } from '@/features/groups/ui/PaymentsSection';
import { TodosSection } from '@/features/groups/ui/TodosSection';
import { GroupDocumentsList } from '@/features/documents/ui/GroupDocumentsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { usePermissions } from '@/zero/rbac';

export const Route = createFileRoute('/_authed/group/$id/operation')({
  component: GroupOperationPage,
});

export function GroupOperationPage() {
  const { id } = Route.useParams();
  const { hash } = useLocation();
  const { canManage, canView, isLoading, isMember } = usePermissions({ groupId: id });

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

  const canManageLinks = canManage('groupLinks');
  const canManagePayments = canManage('groupPayments');
  const canManageTodos = canManage('groupTodos');
  const canManageDocuments = canManage('groupDocuments');

  return (
    <AuthorizedGroupOperationPage
      canManageDocuments={canManageDocuments}
      canManageLinks={canManageLinks}
      canManagePayments={canManagePayments}
      canManageTodos={canManageTodos}
      canViewDocuments={canViewDocuments}
      canViewLinks={canViewLinks}
      canViewPayments={canViewPayments}
      canViewTodos={canViewTodos}
      groupId={id}
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
  groupId: id,
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
  } = useGroupOperationPage(id);

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
    <div className="space-y-8">
      {/* 1. Links */}
      {canViewLinks ? (
        <LinksSection
          links={links}
          addLinkButton={
            canManageLinks ? (
              <AddLinkDialog
                isOpen={linkDialogOpen}
                onOpenChange={setLinkDialogOpen}
                onSubmit={handleAddLink}
              />
            ) : null
          }
        />
      ) : null}

      {/* 2. Payments */}
      {canViewPayments ? (
        <section id="payments" className="scroll-mt-24">
          <PaymentsSection
            canManagePayments={canManagePayments}
            groupId={id}
            storageKey={`group-${id}-payments`}
            payments={payments}
            summary={summary}
            incomeData={incomeData}
            expenditureData={expenditureData}
          />
        </section>
      ) : null}

      {/* 3. Todos */}
      {canViewTodos ? (
        <section id="todos" className="scroll-mt-24">
          <TodosSection
            canManageTodos={canManageTodos}
            groupId={id}
            storageKey={`group-${id}-todos`}
            todos={todos as import('@/features/todos/types/todo.types').Todo[]}
            viewMode={todoViewMode}
            onViewModeChange={setTodoViewMode}
            onToggleComplete={toggleTodoComplete}
          />
        </section>
      ) : null}

      {/* 4. Documents */}
      {canViewDocuments ? (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupDocumentsList
              groupId={id}
              groupName={groupName}
              userId={userId}
              storageKey={`group-${id}-documents`}
              canManageDocuments={canManageDocuments}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
