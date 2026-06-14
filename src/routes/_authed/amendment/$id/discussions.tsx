import { createFileRoute } from '@tanstack/react-router';
import { DiscussionsPageContainer } from '@/features/discussions/ui/DiscussionsPageContainer';
import { useAuth } from '@/providers/auth-provider';

export const Route = createFileRoute('/_authed/amendment/$id/discussions')({
  component: AmendmentDiscussionsPage,
});

function AmendmentDiscussionsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  return <DiscussionsPageContainer amendmentId={id} userId={user?.id ?? ''} />;
}
