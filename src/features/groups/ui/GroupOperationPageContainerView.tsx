import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GroupDocumentsList } from '@/features/documents/ui/GroupDocumentsList';
import { GroupDatasetsSection } from '@/features/groups/ui/GroupDatasetsSection';
import { PaymentsSection } from '@/features/groups/ui/PaymentsSection';
import { TodosSection } from '@/features/groups/ui/TodosSection';
import { AddLinkDialog } from '@/features/network/ui/AddLinkDialog';
import { LinksSection } from '@/features/network/ui/LinksSection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '@/features/shared/ui/layout';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { AuthorizedGroupOperationPage } from './AuthorizedGroupOperationPage';
export interface GroupOperationPageContainerViewProps {
  groupId: any;
  hash: any;
  canManage: any;
  canView: any;
  isLoading: any;
  isMember: any;
  canViewDatasets: any;
  canViewDocuments: any;
  canViewLinks: any;
  canViewPayments: any;
  canViewTodos: any;
  canAccessOperation: any;
}

export function GroupOperationPageContainerView({
  groupId,
  hash,
  canManage,
  isLoading,
  isMember,
  canViewDatasets,
  canViewDocuments,
  canViewLinks,
  canViewPayments,
  canViewTodos,
  canAccessOperation,
}: GroupOperationPageContainerViewProps) {
  if (isLoading) {
    return <PageSkeleton variant="settings" />;
  }

  if (!isMember() || !canAccessOperation) {
    return <AccessDenied />;
  }

  return (
    <AuthorizedGroupOperationPage
      canManageDocuments={canManage('groupDocuments')}
      canManageDatasets={canManage('groupDatasets')}
      canManageLinks={canManage('groupLinks')}
      canManagePayments={canManage('groupPayments')}
      canManageTodos={canManage('groupTodos')}
      canViewDatasets={canViewDatasets}
      canViewDocuments={canViewDocuments}
      canViewLinks={canViewLinks}
      canViewPayments={canViewPayments}
      canViewTodos={canViewTodos}
      groupId={groupId}
      hash={hash}
    />
  );
}

export interface GroupOperationPageViewProps {
  canManageDatasets: boolean;
  canManageDocuments: boolean;
  canManageLinks: boolean;
  canManagePayments: boolean;
  canManageTodos: boolean;
  canViewDatasets: boolean;
  canViewDocuments: boolean;
  canViewLinks: boolean;
  canViewPayments: boolean;
  canViewTodos: boolean;
  groupId: string;
  userId: any;
  groupName: any;
  links: any;
  linkDialogOpen: boolean;
  onLinkDialogOpenChange: (open: boolean) => void;
  handleAddLink: any;
  payments: any;
  summary: any;
  incomeData: any;
  expenditureData: any;
  todos: any[];
  todoViewMode: any;
  onTodoViewModeChange: any;
  onToggleTodoComplete: any;
}

export function GroupOperationPageView({
  canManageDatasets,
  canManageDocuments,
  canManageLinks,
  canManagePayments,
  canManageTodos,
  canViewDatasets,
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
      {canViewDatasets ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>{translateText('features.groups.datasets.title', 'Datasets')}</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <GroupDatasetsSection groupId={groupId} canManageDatasets={canManageDatasets} />
          </PanelContent>
        </Panel>
      ) : null}

      {canViewLinks ? (
        <LinksSection
          links={links}
          addLinkButton={
            canManageLinks ? (
              <AddLinkDialog
                data-action-scope="presentation"
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
