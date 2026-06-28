import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useZeroReady } from '@/providers/zero-provider';
import { useBlogRouteFamilyPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/group/$id/blog/$entryId')({
  component: GroupBlogLayout,
});

function GroupBlogLayout() {
  const { entryId, id } = Route.useParams();
  const zeroReady = useZeroReady();
  useBlogRouteFamilyPreloads(entryId);
  const { data, isLoading, error, recoveryDraft } = useEntityRouteAccess({
    entityType: 'blog',
    entityId: entryId,
    parentType: 'group',
    parentId: id,
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
