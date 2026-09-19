import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';

export const Route = createFileRoute('/_authed/user/$id/editor')({
  component: UserEditorPage,
});

function UserEditorPage() {
  const { id } = Route.useParams();

  const { user } = useAuth();
  const hasDocumentRoute = useRouterState({
    select: state =>
      state.matches.some(match => match.routeId === '/_authed/user/$id/editor/$docId'),
  });

  if (!user || user.id !== id) {
    return <AccessDenied />;
  }

  return hasDocumentRoute ? (
    <Outlet />
  ) : (
    <EditorView entityType="document" entityId={id} userId={id} />
  );
}
