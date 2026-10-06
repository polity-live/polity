import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StudioProjectAccess } from '@/features/communication-studio/ui/StudioProjectAccess';

export const Route = createFileRoute('/_authed/studio/$projectId')({
  validateSearch: z.object({
    conversationId: z.string().uuid().optional(),
    workspaceId: z.string().uuid().optional(),
    focusNodeId: z.string().min(1).max(200).optional(),
  }),
  component: StudioProject,
});

function StudioProject() {
  const { projectId } = Route.useParams();
  const { conversationId, workspaceId, focusNodeId } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StudioProjectAccess
      groupId={null}
      projectId={projectId}
      conversationId={conversationId}
      workspaceId={workspaceId}
      focusNodeId={focusNodeId}
      onFocusHandled={nextWorkspaceId =>
        void navigate({ search: { conversationId, workspaceId: nextWorkspaceId }, replace: true })
      }
      open={next => void navigate({ to: '/studio/$projectId', params: { projectId: next } })}
    />
  );
}
