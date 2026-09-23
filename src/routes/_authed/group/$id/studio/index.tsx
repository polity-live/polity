import { createFileRoute } from '@tanstack/react-router';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/group/$id/studio/')({
  component: GroupStudioOverview,
});

function GroupStudioOverview() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      groupId={id}
      open={projectId =>
        void navigate({ to: '/group/$id/studio/$projectId', params: { id, projectId } })
      }
    />
  );
}
