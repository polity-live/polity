import { createFileRoute } from '@tanstack/react-router';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useUserState } from '@/zero/users/useUserState';
import { mapEditorUserRecord } from '@/routes/_authed';

export const Route = createFileRoute('/_authed/group/$id/editor/$docId')({
  component: GroupEditorDocPage,
});

function GroupEditorDocPage() {
  const { id, docId } = Route.useParams();
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const { canManage } = usePermissions({ groupId: id });

  const userRecord = mapEditorUserRecord(currentUser, user?.email);

  return (
    <EditorView
      entityType="groupDocument"
      entityId={docId}
      userId={user?.id}
      userRecord={userRecord}
      readOnly={!canManage('groupDocuments')}
    />
  );
}
