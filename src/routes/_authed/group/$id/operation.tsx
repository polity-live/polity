import { createFileRoute, useLocation } from '@tanstack/react-router';

import { GroupOperationPageContainer } from '@/features/groups/ui/GroupOperationPageContainer';

export const Route = createFileRoute('/_authed/group/$id/operation')({
  component: GroupOperationPage,
});

function GroupOperationPage() {
  const { id } = Route.useParams();
  const { hash } = useLocation();

  return <GroupOperationPageContainer groupId={id} hash={hash} />;
}
