import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';

export const Route = createFileRoute('/_authed/user/$id/editor/$docId')({
  component: UserEditorDocPage,
});

function UserEditorDocPage() {
  const { id, docId } = Route.useParams();
  const { user } = useAuth();
  const { currentUser } = useUserState();

  if (!user || user.id !== id) {
    return <AccessDenied />;
  }

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
    <EditorView entityType="document" entityId={docId} userId={user?.id} userRecord={userRecord} />
  );
}
