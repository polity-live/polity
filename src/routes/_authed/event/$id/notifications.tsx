import { createFileRoute } from '@tanstack/react-router';
import { EntityNotifications } from '@/features/notifications/ui/EntityNotifications.tsx';
import { useEventById } from '@/zero/events/useEventState';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';

export const Route = createFileRoute('/_authed/event/$id/notifications')({
  component: EventNotificationsPage,
});

function EventNotificationsPage() {
  const { id } = Route.useParams();
  const { can, isParticipant, isLoading } = usePermissions({ eventId: id });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!isParticipant() || !can('viewNotifications', 'notifications')) {
    return <AccessDenied />;
  }

  return <EventNotificationsContent eventId={id} />;
}

function EventNotificationsContent({ eventId }: { eventId: string }) {
  const { event } = useEventById(eventId);

  return (
    <EntityNotifications entityId={eventId} entityType="event" entityName={event?.title ?? ''} />
  );
}
