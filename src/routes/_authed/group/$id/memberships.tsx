import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { GroupMembershipsPageContainer } from '@/features/groups/ui/GroupMembershipsPageContainer';

export const groupMembershipsSearchSchema = z.object({
  tab: z
    .enum([
      'membershipsByUser',
      'membershipsByRole',
      'composition',
      'rightsAlignment',
      'openAssignments',
      'guests',
      'roles',
    ])
    .catch('membershipsByUser')
    .optional(),
  assignmentId: z.string().optional(),
});

export const Route = createFileRoute('/_authed/group/$id/memberships')({
  validateSearch: groupMembershipsSearchSchema,
  component: GroupMembershipsRoute,
});

function GroupMembershipsRoute() {
  const { id } = Route.useParams();
  const { tab, assignmentId } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <GroupMembershipsPageContainer
      groupId={id}
      defaultTab={tab}
      focusAssignmentId={assignmentId}
      onTabChange={nextTab =>
        navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true })
      }
    />
  );
}
