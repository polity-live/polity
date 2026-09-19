import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';
export const Route = createFileRoute('/_authed/group/$id/studio')({
  validateSearch: z.object({ project: z.string().uuid().optional() }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  const { project } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StudioWorkspace
      groupId={id}
      projectId={project}
      open={project => navigate({ search: { project } })}
    />
  );
}
