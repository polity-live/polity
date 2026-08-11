import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { EntityNotifications } from '@/features/notifications/ui/EntityNotifications.tsx';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { usePermissions } from '@/zero/rbac/usePermissions';
import type { ActionRight, Amendment } from '@/zero/rbac/types';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';

export const Route = createFileRoute('/_authed/amendment/$id/notifications')({
  component: AmendmentNotificationsPage,
});

function AmendmentNotificationsPage() {
  const { id } = Route.useParams();
  const {
    amendment,
    collaborators,
    roles,
    isLoading: amendmentIsLoading,
  } = useAmendmentState({
    amendmentId: id,
    includeRoles: true,
  });

  const amendmentForPermissions = useMemo(() => {
    if (!amendment) return undefined;

    const mappedRoles = (roles ?? []).map(role => ({
      id: role.id,
      name: role.name ?? '',
      description: role.description ?? undefined,
      scope: (role.scope ?? 'amendment') as 'group' | 'event' | 'amendment' | 'blog',
      actionRights: (role.action_rights ?? []).map(ar => ({
        id: String(ar.id),
        resource: String(ar.resource ?? '') as ActionRight['resource'],
        action: String(ar.action ?? '') as ActionRight['action'],
        group: ar.group_id ? { id: String(ar.group_id) } : undefined,
        event: ar.event_id ? { id: String(ar.event_id) } : undefined,
        amendment: ar.amendment_id ? { id: String(ar.amendment_id) } : undefined,
        blog: ar.blog_id ? { id: String(ar.blog_id) } : undefined,
      })),
    }));

    return {
      id: amendment.id,
      user: amendment.created_by ? { id: amendment.created_by.id } : undefined,
      group: amendment.group ? { id: amendment.group.id } : undefined,
      roles: mappedRoles,
      amendmentRoleCollaborators: (collaborators ?? []).map(collaborator => ({
        id: collaborator.id,
        user: collaborator.user ? { id: collaborator.user.id } : undefined,
        role: mappedRoles.find(role => role.id === collaborator.role_id),
      })),
    } as Amendment;
  }, [amendment, collaborators, roles]);

  const { can, isCollaborator, isAuthor, isLoading } = usePermissions({
    amendmentId: id,
    amendment: amendmentForPermissions,
  });

  if (amendmentIsLoading || isLoading) {
    return <PageSkeleton />;
  }

  if (!(isCollaborator() || isAuthor()) || !can('viewNotifications', 'notifications')) {
    return <AccessDenied />;
  }

  return (
    <EntityNotifications entityId={id} entityType="amendment" entityName={amendment?.title ?? ''} />
  );
}
