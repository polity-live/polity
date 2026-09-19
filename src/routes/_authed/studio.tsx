import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StudioWorkspace } from '@/features/communication-studio/ui/StudioWorkspace';
export const Route = createFileRoute('/_authed/studio')({
  validateSearch: z.object({ project: z.string().uuid().optional() }),
  component: Page,
});
function Page() {
  const { project } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <StudioWorkspace projectId={project} open={id => navigate({ search: { project: id } })} />;
}
