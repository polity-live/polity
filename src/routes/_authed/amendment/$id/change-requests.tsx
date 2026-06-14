import { createFileRoute } from '@tanstack/react-router';
import { ChangeRequestsPageContainer } from '@/features/change-requests/ui/ChangeRequestsPageContainer';
import { useAuth } from '@/providers/auth-provider';

export const Route = createFileRoute('/_authed/amendment/$id/change-requests')({
  component: AmendmentChangeRequestsPage,
});

function AmendmentChangeRequestsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  return <ChangeRequestsPageContainer amendmentId={id} userId={user?.id ?? ''} />;
}
