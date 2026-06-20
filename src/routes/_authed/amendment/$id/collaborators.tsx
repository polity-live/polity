import { createFileRoute } from '@tanstack/react-router';
import { useCollaboratorsPageController } from '@/features/amendments/collaborators/hooks/useCollaboratorsPageController';
import { CollaboratorsView } from '@/features/amendments/collaborators/ui/CollaboratorsView';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { useAuth } from '@/providers/auth-provider';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';

export const Route = createFileRoute('/_authed/amendment/$id/collaborators')({
  component: AmendmentCollaboratorsPage,
});

export function AmendmentCollaboratorsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { amendment, isLoading: amendmentLoading } = useAmendmentState({ amendmentId: id });
  const collaboratorsController = useCollaboratorsPageController({
    amendmentId: id,
    currentUserId: user?.id,
  });

  if (amendmentLoading || collaboratorsController.isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  const canManageCollaborators =
    amendment?.created_by_id === user?.id || collaboratorsController.canManageCollaborators;

  if (!canManageCollaborators) {
    return <AccessDenied />;
  }

  return (
    <CollaboratorsView
      {...collaboratorsController}
      amendmentId={id}
      amendmentTitle={amendment?.title ?? ''}
    />
  );
}
