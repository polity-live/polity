import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { createPreloadEntry, useZeroPreloads } from './preload-registry';

/** Shell-critical data stays eager because navigation, badges and push setup consume it. */
export function useCoreZeroPreloads() {
  const { user } = useAuth();
  const entries = useMemo(() => {
    if (!user?.id) return [];
    return [
      createPreloadEntry('queries.users.current', {}, queries.users.current({})),
      createPreloadEntry('queries.notifications.settings', {}, queries.notifications.settings({})),
      createPreloadEntry(
        'queries.notifications.pushSubscriptions',
        {},
        queries.notifications.pushSubscriptions({})
      ),
      createPreloadEntry(
        'queries.messages.conversationsForUnread',
        {},
        queries.messages.conversationsForUnread({})
      ),
    ];
  }, [user?.id]);
  useZeroPreloads(entries);
}

/** Exact queries used by the profile menu's Groups, Events and Amendments sections. */
export function useRelationshipEntityPreloads() {
  const { user } = useAuth();
  const entries = useMemo(() => {
    if (!user?.id) return [];
    return [
      createPreloadEntry(
        'queries.groups.currentUserMembershipsWithGroups',
        {},
        queries.groups.currentUserMembershipsWithGroups({})
      ),
      createPreloadEntry(
        'queries.events.userParticipationsWithEvent',
        { userId: user.id },
        queries.events.userParticipationsWithEvent({ userId: user.id })
      ),
      createPreloadEntry(
        'queries.amendments.currentUserOpenNavigationAmendments',
        {},
        queries.amendments.currentUserOpenNavigationAmendments({})
      ),
    ];
  }, [user?.id]);
  useZeroPreloads(entries);
}

export function useGlobalZeroPreloads() {
  useCoreZeroPreloads();
  useRelationshipEntityPreloads();
}
