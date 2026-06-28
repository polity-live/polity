import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useZeroReady } from '@/providers/zero-provider';
import { useAmendmentRouteFamilyPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/amendment/$id')({
  component: AmendmentLayout,
});

function AmendmentLayout() {
  const { id } = Route.useParams();
  const zeroReady = useZeroReady();
  useAmendmentRouteFamilyPreloads(id);
  const { data, isLoading, error, recoveryDraft } = useEntityRouteAccess({
    entityType: 'amendment',
    entityId: id,
  });

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
