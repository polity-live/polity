import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useZeroReady } from '@/providers/zero-ready-context';
import { useAmendmentRouteFamilyPreloads } from '@/zero/preloads';
import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';

export const Route = createFileRoute('/_authed/amendment/$id')({
  component: AmendmentLayout,
});

function AmendmentLayout() {
  const { id } = Route.useParams();
  const zeroReady = useZeroReady();
  useAmendmentRouteFamilyPreloads(id);
  const [amendment, amendmentResult] = useQuery(
    zeroReady ? queries.amendments.byId({ id }) : undefined
  );
  const { data, isLoading, error, recoveryDraft } = useEntityRouteAccess(
    {
      entityType: 'amendment',
      entityId: id,
    },
    {
      entityType: 'amendment',
      entityId: id,
      ownerId: amendment?.created_by_id,
      visibility: amendment?.visibility,
      complete: amendmentResult.type === 'complete' && amendment?.id === id,
    }
  );

  return (
    <EntityVisibilityGuard
      entityExists={data?.exists ?? false}
      hasError={!!error}
      isLoading={isLoading || (data?.exists === true && !zeroReady)}
      visibilities={data?.visibilities ?? []}
      canAccessPrivate={data?.canAccessPrivate ?? false}
      recoveryDraft={recoveryDraft}
    >
      <Outlet />
    </EntityVisibilityGuard>
  );
}
