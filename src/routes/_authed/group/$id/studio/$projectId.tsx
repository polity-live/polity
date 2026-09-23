import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StudioProjectAccess } from '@/features/communication-studio/ui/StudioProjectAccess';

export const Route = createFileRoute('/_authed/group/$id/studio/$projectId')({
  validateSearch: z.object({ conversationId: z.string().uuid().optional() }),
  component: GroupStudioProject,
});

function GroupStudioProject() {
  const { id, projectId } = Route.useParams();
  const { conversationId } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StudioProjectAccess
      groupId={id}
      projectId={projectId}
      conversationId={conversationId}
      open={next =>
        void navigate({ to: '/group/$id/studio/$projectId', params: { id, projectId: next } })
      }
    />
  );
}
