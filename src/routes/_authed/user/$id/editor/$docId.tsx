import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { mapEditorUserRecord } from '@/routes/_authed';

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

  const userRecord = mapEditorUserRecord(currentUser, user?.email);

  return (
    <EditorView entityType="document" entityId={docId} userId={user?.id} userRecord={userRecord} />
  );
}
