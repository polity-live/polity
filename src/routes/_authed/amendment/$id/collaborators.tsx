import { createFileRoute } from '@tanstack/react-router';
import { useCollaboratorsPageController } from '@/features/amendments/collaborators/hooks/useCollaboratorsPageController';
import { CollaboratorsView } from '@/features/amendments/collaborators/ui/CollaboratorsView';
import { useAuth } from '@/providers/auth-provider';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';

export const Route = createFileRoute('/_authed/amendment/$id/collaborators')({
  component: AmendmentCollaboratorsPage,
});

function AmendmentCollaboratorsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { amendment } = useAmendmentState({ amendmentId: id });
  const collaboratorsController = useCollaboratorsPageController({
    amendmentId: id,
    currentUserId: user?.id,
  });

  return (
    <CollaboratorsView
      {...collaboratorsController}
      amendmentId={id}
      amendmentTitle={amendment?.title ?? ''}
    />
  );
}
