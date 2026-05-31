import { createFileRoute } from '@tanstack/react-router';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useUserState } from '@/zero/users/useUserState';

export const Route = createFileRoute('/_authed/group/$id/editor/$docId')({
  component: GroupEditorDocPage,
});

export function GroupEditorDocPage() {
  const { id, docId } = Route.useParams();
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const { canManage } = usePermissions({ groupId: id });

  const userRecord = currentUser
    ? {
        id: currentUser.id,
        name:
          [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') ||
          currentUser.handle ||
          '',
        email: user?.email,
        avatar: currentUser.avatar ?? undefined,
      }
    : undefined;

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
