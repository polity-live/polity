import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useAuth } from '@/providers/auth-provider';
import { useZeroReady } from '@/providers/zero-provider';

export const Route = createFileRoute('/_authed/user/$id')({
  component: UserLayout,
});

function UserLayout() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const zeroReady = useZeroReady();
  const { data, isLoading, error } = useEntityRouteAccess({
    entityType: 'user',
    entityId: id,
  });

  return (
    <EntityVisibilityGuard
      entityExists={data?.exists ?? false}
      hasError={!!error}
      isLoading={isLoading || (data?.exists === true && !zeroReady)}
      visibilities={data?.visibilities ?? []}
      canAccessPrivate={user?.id === id}
    >
      <Outlet />
    </EntityVisibilityGuard>
  );
}
