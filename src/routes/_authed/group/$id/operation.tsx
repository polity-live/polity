import { useEffect } from 'react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { useGroupOperationPage } from '@/features/groups/hooks/useGroupOperationPage';
import { LinksSection } from '@/features/network/ui/LinksSection';
import { AddLinkDialog } from '@/features/network/ui/AddLinkDialog';
import { PaymentsSection } from '@/features/groups/ui/PaymentsSection';
import { TodosSection } from '@/features/groups/ui/TodosSection';
import { GroupDocumentsList } from '@/features/documents/ui/GroupDocumentsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';

export const Route = createFileRoute('/_authed/group/$id/operation')({
  component: GroupOperationPage,
});

function GroupOperationPage() {
  const { id } = Route.useParams();
  const { hash } = useLocation();
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
      <LinksSection
        links={links}
        addLinkButton={
          <AddLinkDialog
            isOpen={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
            onSubmit={handleAddLink}
          />
        }
      />

      {/* 2. Payments */}
      <section id="payments" className="scroll-mt-24">
        <PaymentsSection
          groupId={id}
          storageKey={`group-${id}-payments`}
          payments={payments}
          summary={summary}
          incomeData={incomeData}
          expenditureData={expenditureData}
        />
      </section>

      {/* 3. Todos */}
      <section id="todos" className="scroll-mt-24">
        <TodosSection
          groupId={id}
          storageKey={`group-${id}-todos`}
          todos={todos as import('@/features/todos/types/todo.types').Todo[]}
          viewMode={todoViewMode}
          onViewModeChange={setTodoViewMode}
          onToggleComplete={toggleTodoComplete}
        />
      </section>

      {/* 4. Documents */}
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
