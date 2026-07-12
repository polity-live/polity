import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { useAmendmentCollaboration } from '@/features/amendments/hooks/useAmendmentCollaboration';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useAuth } from '@/providers/auth-provider';
import { AmendmentEditContent } from '@/features/amendments/ui/AmendmentEditContent';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import { z } from 'zod';

const settingsSearchSchema = z.object({
  tab: z.enum(['general', 'workflow', 'location']).catch('general').optional(),
});

export const Route = createFileRoute('/_authed/amendment/$id/settings')({
  validateSearch: settingsSearchSchema,
  component: AmendmentSettingsPage,
});

function AmendmentSettingsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const collaboration = useAmendmentCollaboration(id);
  const { amendment, amendmentProcess, isLoading } = useAmendmentState({
    amendmentId: id,
    includeProcessData: true,
  });

  if (collaboration.isLoading) {
    return <PageSkeleton />;
  }

  if (!user || (!collaboration.isCollaborator && !collaboration.isAdmin)) {
    return <AccessDenied />;
  }

  if (!isLoading && !amendment) {
    return <NotFound />;
  }

  const agendaItemId = amendmentProcess?.agenda_items?.[0]?.id;

  return (
    <AmendmentEditContent
      amendmentId={id}
      amendment={amendment}
      amendmentProcess={amendmentProcess}
      currentUserId={user?.id || ''}
      isLoading={isLoading}
      mode="edit"
      agendaItemId={agendaItemId}
      activeTab={tab ?? 'general'}
      onTabChange={nextTab =>
        navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true })
      }
    />
  );
}
