import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { usePermissions } from '@/zero/rbac';

export const Route = createFileRoute('/_authed/group/$id/editor')({
  component: GroupEditorLayout,
});

function GroupEditorLayout() {
  const { id: groupId } = Route.useParams();
  const { canView, isLoading, isMember } = usePermissions({ groupId });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isMember() || !canView('groupDocuments')) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
