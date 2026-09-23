import { createFileRoute } from '@tanstack/react-router';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/whiteboards/$projectId')({
  component: WhiteboardProject,
});

function WhiteboardProject() {
  const { projectId } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      whiteboards
      projectId={projectId}
      open={next => void navigate({ to: '/whiteboards/$projectId', params: { projectId: next } })}
    />
  );
}
