import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { usePermissions } from '@/zero/rbac';

export const Route = createFileRoute('/_authed/group/$id/editor')({
  component: GroupEditorLayout,
});

export function GroupEditorLayout() {
  const { id: groupId } = Route.useParams();
  const { canView, isLoading, isMember } = usePermissions({ groupId });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!isMember() || !canView('groupDocuments')) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
