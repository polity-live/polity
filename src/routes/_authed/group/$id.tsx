import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useZeroReady } from '@/providers/zero-ready-context';
import { useGroupRouteFamilyPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/group/$id')({
  component: GroupLayout,
});

function GroupLayout() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const zeroReady = useZeroReady();
  useGroupRouteFamilyPreloads(id);
  const { data, isLoading, error, recoveryDraft } = useEntityRouteAccess({
    entityType: 'group',
    entityId: id,
  });

  const studioPath = `/group/${id}/studio`;
  if (pathname === studioPath || pathname.startsWith(`${studioPath}/`)) return <Outlet />;

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
