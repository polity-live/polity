import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EventParticipants } from '@/features/events/ui/EventParticipants';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { usePermissions } from '@/zero/rbac';

export const participantsSearchSchema = z.object({
  tab: z
    .enum(['membershipsByUser', 'membershipsByRole', 'composition', 'guests', 'roles'])
    .optional(),
});

export const Route = createFileRoute('/_authed/event/$id/participants')({
  validateSearch: participantsSearchSchema,
  component: EventParticipantsPage,
});

function EventParticipantsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();

  const { can, isLoading } = usePermissions({ eventId: id });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!can('manage', 'events')) {
    return <AccessDenied />;
  }

  return <EventParticipants eventId={id} defaultTab={tab} />;
}
