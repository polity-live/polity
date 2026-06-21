import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { AmendmentProcessFlow } from '@/features/amendments/ui/AmendmentProcessFlow';

const amendmentProcessSearchSchema = z.object({
  branch: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/amendment/$id/process')({
  validateSearch: search => amendmentProcessSearchSchema.parse(search),
  component: AmendmentProcessPage,
});

function AmendmentProcessPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AmendmentProcessFlow
      amendmentId={id}
      requestedBranchId={search.branch}
      onBranchChange={(branchId, options) =>
        navigate({
          to: '/amendment/$id/process',
          params: { id },
          search: { branch: branchId ?? undefined },
          replace: options?.replace,
        })
      }
    />
  );
}
