import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ChangeRequestsPageContainer } from '@/features/change-requests/ui/ChangeRequestsPageContainer';
import { useAuth } from '@/providers/auth-provider';

const amendmentChangeRequestsSearchSchema = z.object({
  branch: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/amendment/$id/change-requests')({
  validateSearch: search => amendmentChangeRequestsSearchSchema.parse(search),
  component: AmendmentChangeRequestsPage,
});

function AmendmentChangeRequestsPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <ChangeRequestsPageContainer
      amendmentId={id}
      userId={user?.id ?? ''}
      requestedBranchId={search.branch}
      onBranchChange={(branchId, options) =>
        navigate({
          to: '/amendment/$id/change-requests',
          params: { id },
          search: { branch: branchId ?? undefined },
          replace: options?.replace,
        })
      }
    />
  );
}
