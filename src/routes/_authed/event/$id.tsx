import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EntityVisibilityGuard } from '@/features/auth/EntityVisibilityGuard';
import { useEntityRouteAccess } from '@/features/auth/hooks/useEntityRouteAccess';
import { useZeroReady } from '@/providers/zero-ready-context';
import { useEventRouteFamilyPreloads } from '@/zero/preloads';
import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';

export const Route = createFileRoute('/_authed/event/$id')({
  component: EventLayout,
});

function EventLayout() {
  const { id } = Route.useParams();
  const zeroReady = useZeroReady();
  useEventRouteFamilyPreloads(id);
  const [event, eventResult] = useQuery(zeroReady ? queries.events.byId({ id }) : undefined);
  const { data, isLoading, error, recoveryDraft } = useEntityRouteAccess(
    {
      entityType: 'event',
      entityId: id,
    },
    {
      entityType: 'event',
      entityId: id,
      ownerId: event?.creator_id,
      visibility: event?.visibility,
      complete: eventResult.type === 'complete' && event?.id === id,
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
