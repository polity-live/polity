import { createFileRoute } from '@tanstack/react-router';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/whiteboards/')({ component: WhiteboardOverview });

function WhiteboardOverview() {
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      whiteboards
      open={projectId => void navigate({ to: '/whiteboards/$projectId', params: { projectId } })}
    />
  );
}
