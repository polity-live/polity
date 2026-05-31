import { createFileRoute } from '@tanstack/react-router';
import { GroupDocumentsList } from '@/features/documents/ui/GroupDocumentsList';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';

export const Route = createFileRoute('/_authed/group/$id/editor/')({
  component: GroupEditorIndexPage,
});

export function GroupEditorIndexPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { canManage } = usePermissions({ groupId: id });

  return (
    <GroupDocumentsList
      groupId={id}
      userId={user?.id}
      canManageDocuments={canManage('groupDocuments')}
    />
  );
}
