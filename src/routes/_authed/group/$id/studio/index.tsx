import { createFileRoute } from '@tanstack/react-router';
import { StudioProjectOverview } from '@/features/communication-studio/ui/StudioProjectOverview';
import { useStudioState } from '@/zero/communication-studio/useStudioState';
import { useAuth } from '@/providers/auth-provider';

export const Route = createFileRoute('/_authed/group/$id/studio/')({
  component: GroupStudioOverview,
});

function GroupStudioOverview() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { projects, isLoading } = useStudioState(id);
  return (
    <StudioProjectOverview
      groupId={id}
      ownerId={user?.id ?? ''}
      projects={projects}
      isLoading={isLoading}
      failure=""
      projectHref={projectId =>
        `/group/${encodeURIComponent(id)}/studio/${encodeURIComponent(projectId)}`
      }
    />
  );
}
