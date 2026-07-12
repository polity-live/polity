import { createFileRoute } from '@tanstack/react-router';
import { useCollaboratorsPageController } from '@/features/amendments/collaborators/hooks/useCollaboratorsPageController';
import { CollaboratorsView } from '@/features/amendments/collaborators/ui/CollaboratorsView';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useAuth } from '@/providers/auth-provider';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { z } from 'zod';

export const collaboratorsSearchSchema = z.object({
  tab: z
    .enum(['membershipsByUser', 'membershipsByRole', 'roles'])
    .catch('membershipsByUser')
    .optional(),
});

export const Route = createFileRoute('/_authed/amendment/$id/collaborators')({
  validateSearch: collaboratorsSearchSchema,
  component: AmendmentCollaboratorsPage,
});

function AmendmentCollaboratorsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const { amendment, isLoading: amendmentLoading } = useAmendmentState({ amendmentId: id });
  const collaboratorsController = useCollaboratorsPageController({
    amendmentId: id,
    currentUserId: user?.id,
    initialTab: tab ?? 'membershipsByUser',
    onTabChange: nextTab => {
      if (
        nextTab === 'membershipsByUser' ||
        nextTab === 'membershipsByRole' ||
        nextTab === 'roles'
      ) {
        void navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true });
      }
    },
  });

  if (amendmentLoading || collaboratorsController.isLoading) {
    return <PageSkeleton />;
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
