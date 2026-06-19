import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useZeroReady } from '@/providers/zero-provider';
import { useGroupRouteFamilyPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/group/$id')({
  component: GroupLayout,
});

function GroupLayout() {
  const { id } = Route.useParams();
  const zeroReady = useZeroReady();
  useGroupRouteFamilyPreloads(id);
  const { data, isLoading, error } = useEntityRouteAccess({
    entityType: 'group',
    entityId: id,
  });

  return (
    <EntityVisibilityGuard
      entityExists={data?.exists ?? false}
      hasError={!!error}
      isLoading={isLoading || (data?.exists === true && !zeroReady)}
      visibilities={data?.visibilities ?? []}
      canAccessPrivate={data?.canAccessPrivate ?? false}
    >
      <Outlet />
    </EntityVisibilityGuard>
  );
}
