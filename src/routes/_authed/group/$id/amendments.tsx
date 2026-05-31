import { createFileRoute } from '@tanstack/react-router';
import { GroupAmendmentsPage } from '@/features/groups/ui/GroupAmendmentsPage';

export const Route = createFileRoute('/_authed/group/$id/amendments')({
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  return <GroupAmendmentsPage groupId={id} />;
}
