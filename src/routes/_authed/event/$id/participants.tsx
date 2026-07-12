import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EventParticipants } from '@/features/events/ui/EventParticipants';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { usePermissions } from '@/zero/rbac';

export const participantsSearchSchema = z.object({
  tab: z
    .enum(['membershipsByUser', 'membershipsByRole', 'composition', 'guests', 'roles'])
    .catch('membershipsByUser')
    .optional(),
});

export const Route = createFileRoute('/_authed/event/$id/participants')({
  validateSearch: participantsSearchSchema,
  component: EventParticipantsPage,
});

function EventParticipantsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { can, isLoading } = usePermissions({ eventId: id });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!can('manage', 'events')) {
    return <AccessDenied />;
  }

  return (
    <EventParticipants
      eventId={id}
      defaultTab={tab}
      onTabChange={nextTab => {
        if (
          nextTab === 'membershipsByUser' ||
          nextTab === 'membershipsByRole' ||
          nextTab === 'composition' ||
          nextTab === 'guests' ||
          nextTab === 'roles'
        ) {
          void navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true });
        }
      }}
    />
  );
}
