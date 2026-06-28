import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { GroupEdit } from '@/features/groups/ui/GroupEdit';
import { usePermissions } from '@/zero/rbac/usePermissions';

export const Route = createFileRoute('/_authed/group/$id/settings')({
  component: GroupSettingsPage,
});

function GroupSettingsPage() {
  const { id } = Route.useParams();

  const { can, isMember, isLoading } = usePermissions({ groupId: id });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isMember() || !can('manage', 'groups')) {
    return <AccessDenied />;
  }

  return <GroupEdit groupId={id} />;
}
