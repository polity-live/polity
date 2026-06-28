import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { EventEdit } from '@/features/events/ui/EventEdit';
import { usePermissions } from '@/zero/rbac';

const settingsSearchSchema = z.object({
  tab: z.enum(['basic-info', 'time-series', 'event-type']).optional(),
});

export const Route = createFileRoute('/_authed/event/$id/settings')({
  validateSearch: settingsSearchSchema,
  component: EventSettingsPage,
});

function EventSettingsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();

  const { can, isLoading } = usePermissions({ eventId: id });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!can('manage', 'events')) {
    return <AccessDenied />;
  }

  return <EventEdit eventId={id} defaultTab={tab} />;
}
