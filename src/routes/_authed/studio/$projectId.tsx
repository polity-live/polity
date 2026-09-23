import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';

export const Route = createFileRoute('/_authed/studio/$projectId')({
  validateSearch: z.object({ conversationId: z.string().uuid().optional() }),
  component: StudioProject,
});

function StudioProject() {
  const { projectId } = Route.useParams();
  const { conversationId } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      projectId={projectId}
      conversationId={conversationId}
      open={next => void navigate({ to: '/studio/$projectId', params: { projectId: next } })}
    />
  );
}
