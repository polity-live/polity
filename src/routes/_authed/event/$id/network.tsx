import { createFileRoute } from '@tanstack/react-router';
import { EventNetworkFlow } from '@/features/network/ui/EventNetworkFlow';
import { NetworkViewportPanel } from '@/features/network/ui/NetworkViewportPanel';

export const Route = createFileRoute('/_authed/event/$id/network')({
  component: EventNetworkPage,
});

function EventNetworkPage() {
  const { id } = Route.useParams();
  return (
    <NetworkViewportPanel>
      <EventNetworkFlow eventId={id} />
    </NetworkViewportPanel>
  );
}
