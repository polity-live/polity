import { createFileRoute } from '@tanstack/react-router';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/group/$id/whiteboards/$projectId')({
  component: GroupWhiteboardProject,
});

function GroupWhiteboardProject() {
  const { id, projectId } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      whiteboards
      groupId={id}
      projectId={projectId}
      open={next =>
        void navigate({ to: '/group/$id/whiteboards/$projectId', params: { id, projectId: next } })
      }
    />
  );
}
