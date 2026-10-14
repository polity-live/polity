import { createFileRoute } from '@tanstack/react-router';
import { GroupInvitationPage } from '@/features/groups/ui/GroupInvitationPage';

export const Route = createFileRoute('/invite/$token')({
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: InvitationRoute,
});
function InvitationRoute() {
  const { token } = Route.useParams();
  return <GroupInvitationPage token={token} />;
}
