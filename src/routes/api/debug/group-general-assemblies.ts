import { createAPIFileRoute } from '@tanstack/react-start/api';
import { getSession } from '@/lib/supabase/server';
import { executeZeroRead } from '@/server/zero-mutate';
import { resolveHierarchicalAncestors } from '@/features/groups/logic/hierarchy';
import { zql } from '@/zero/schema';
import {
  buildGroupsById,
  loadActiveHierarchyRelationships,
  loadGroupWithDerivedNetworkMeta,
} from '@/zero/groups/membership-helpers';

function isEventOngoingOrUpcomingByEndDate(event: {
  end_date?: number | null;
  start_date?: number | null;
}) {
  const inviteCutoff = event.end_date ?? event.start_date ?? null;
  return inviteCutoff != null && inviteCutoff >= Date.now();
}

export const APIRoute = createAPIFileRoute('/api/debug/group-general-assemblies')({
  GET: async ({ request }) => {
    const session = await getSession(request);

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
    const membershipId = url.searchParams.get('membershipId');

    if (!membershipId) {
      return new Response('membershipId is required', { status: 400 });
    }

    const payload = await executeZeroRead(async tx => {
      const membership = await tx.run(zql.group_membership.where('id', membershipId).one());
      if (!membership) {
        return {
          membership: null,
          affectedGroupIds: [],
          events: [],
          participations: [],
        };
      }

      const group = await loadGroupWithDerivedNetworkMeta(tx, membership.group_id);
      const affectedGroupIds = new Set<string>([membership.group_id]);

      if (group?.group_type === 'base') {
        const groupsById = await buildGroupsById(tx);
        const hierarchyRelationships = await loadActiveHierarchyRelationships(tx, groupsById);

        for (const groupId of resolveHierarchicalAncestors(
          membership.group_id,
          hierarchyRelationships,
          groupsById
        )) {
          affectedGroupIds.add(groupId);
        }
      }

      const affectedGroupIdList = [...affectedGroupIds];
      const generalAssemblyEvents =
        affectedGroupIdList.length > 0
          ? await tx.run(
              zql.event
                .where('group_id', 'IN', affectedGroupIdList)
                .where('event_type', 'general_assembly')
            )
          : [];

      const eventIds = generalAssemblyEvents.map(event => event.id);
      const participations =
        eventIds.length > 0
          ? await tx.run(
              zql.event_participant
                .where('user_id', membership.user_id)
                .where('event_id', 'IN', eventIds)
            )
          : [];

      return {
        membership: {
          id: membership.id,
          group_id: membership.group_id,
          user_id: membership.user_id,
          status: membership.status ?? null,
          source: membership.source ?? null,
        },
        affectedGroupIds: affectedGroupIdList,
        events: generalAssemblyEvents.map(event => ({
          id: event.id,
          group_id: event.group_id ?? null,
          title: event.title ?? null,
          status: event.status ?? null,
          start_date: event.start_date ?? null,
          end_date: event.end_date ?? null,
          isCancelled: event.status === 'cancelled',
          isOngoingOrUpcomingByEndDate: isEventOngoingOrUpcomingByEndDate(event),
        })),
        participations: participations.map(participation => ({
          id: participation.id,
          event_id: participation.event_id,
          user_id: participation.user_id,
          status: participation.status ?? null,
        })),
      };
    });

    return Response.json(payload);
  },
});
