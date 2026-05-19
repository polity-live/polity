import { createFileRoute } from '@tanstack/react-router';
import { EventRoles } from '@/features/roles/ui/EventRoles';

export const Route = createFileRoute('/_authed/event/$id/roles')({
  component: EventRolesPage,
});

function EventRolesPage() {
  const { id } = Route.useParams();
  return <EventRoles eventId={id} />;
}
