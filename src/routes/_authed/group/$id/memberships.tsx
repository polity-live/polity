import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { GroupMembershipsPageContainer } from '@/features/groups/ui/GroupMembershipsPageContainer';

const groupMembershipsSearchSchema = z.object({
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
    .optional(),
});

export const Route = createFileRoute('/_authed/group/$id/memberships')({
  validateSearch: groupMembershipsSearchSchema,
  component: GroupMembershipsRoute,
});

function GroupMembershipsRoute() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();

  return <GroupMembershipsPageContainer groupId={id} defaultTab={tab} />;
}
