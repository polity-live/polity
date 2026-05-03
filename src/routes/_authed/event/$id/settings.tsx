import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { EventEdit } from '@/features/events/ui/EventEdit';
import { usePermissions } from '@/zero/rbac';

export const Route = createFileRoute('/_authed/event/$id/settings')({
  component: EventSettingsPage,
});

function EventSettingsPage() {
  const { id } = Route.useParams();

  const { can, isLoading } = usePermissions({ eventId: id });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!can('manage', 'events')) {
    return <AccessDenied />;
  }

  return <EventEdit eventId={id} />;
}
