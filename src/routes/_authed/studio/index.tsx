import { createFileRoute } from '@tanstack/react-router';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/studio/')({ component: StudioOverview });

function StudioOverview() {
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      open={projectId => void navigate({ to: '/studio/$projectId', params: { projectId } })}
    />
  );
}
