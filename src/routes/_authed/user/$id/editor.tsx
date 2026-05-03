import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';

export const Route = createFileRoute('/_authed/user/$id/editor')({
  component: UserEditorPage,
});

function UserEditorPage() {
  const { id } = Route.useParams();

  const { user } = useAuth();

  if (!user || user.id !== id) {
    return <AccessDenied />;
  }

  return <EditorView entityType="document" entityId={id} userId={id} />;
}
