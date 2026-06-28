import { createFileRoute } from '@tanstack/react-router';
import { EntityNotifications } from '@/features/notifications/ui/EntityNotifications.tsx';
import { useGroupById } from '@/zero/groups/useGroupState';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';

export const Route = createFileRoute('/_authed/group/$id/notifications')({
  component: GroupNotificationsPage,
});

function GroupNotificationsPage() {
  const { id: groupId } = Route.useParams();
  const { can, isMember, isLoading } = usePermissions({ groupId });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isMember() || !can('viewNotifications', 'groupNotifications')) {
    return <AccessDenied />;
  }

  return <GroupNotificationsContent groupId={groupId} />;
}

function GroupNotificationsContent({ groupId }: { groupId: string }) {
  const { group } = useGroupById(groupId);

  return (
    <EntityNotifications entityId={groupId} entityType="group" entityName={group?.name ?? ''} />
  );
}
