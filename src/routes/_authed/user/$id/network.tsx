import { createFileRoute } from '@tanstack/react-router';
import { UserNetworkFlow } from '@/features/network/ui/UserNetworkFlow';
import { NetworkViewportPanel } from '@/features/network/ui/NetworkViewportPanel';

export const Route = createFileRoute('/_authed/user/$id/network')({
  component: UserNetworkPage,
});

function UserNetworkPage() {
  const { id } = Route.useParams();

  return (
    <NetworkViewportPanel>
      <UserNetworkFlow userId={id} />
    </NetworkViewportPanel>
  );
}
