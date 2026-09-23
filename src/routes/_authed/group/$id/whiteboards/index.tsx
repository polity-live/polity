import { createFileRoute } from '@tanstack/react-router';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/group/$id/whiteboards/')({
  component: GroupWhiteboardOverview,
});

function GroupWhiteboardOverview() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      whiteboards
      groupId={id}
      open={projectId =>
        void navigate({ to: '/group/$id/whiteboards/$projectId', params: { id, projectId } })
      }
    />
  );
}
