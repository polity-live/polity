import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { GroupEdit } from '@/features/groups/ui/GroupEdit';
import { usePermissions } from '@/zero/rbac/usePermissions';

export const Route = createFileRoute('/_authed/group/$id/settings')({
  component: GroupSettingsPage,
});

function GroupSettingsPage() {
  const { id } = Route.useParams();

  const { can, isLoading } = usePermissions({ groupId: id });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!can('manage', 'groups')) {
    return <AccessDenied />;
  }

  return <GroupEdit groupId={id} />;
}
