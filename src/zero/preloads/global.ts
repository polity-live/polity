import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { createPreloadEntry, useZeroPreloads } from './preload-registry';
import { HOME_DISCOVER_SEARCH_ARGS } from './search-context';

export function useCoreZeroPreloads() {
  const { user } = useAuth();
  const userId = user?.id;

  const entries = useMemo(() => {
    if (!userId) return [];

    return [
      createPreloadEntry('queries.users.current', {}, queries.users.current({})),
      createPreloadEntry('queries.notifications.settings', {}, queries.notifications.settings({})),
      createPreloadEntry(
        'queries.notifications.pushSubscriptions',
        {},
        queries.notifications.pushSubscriptions({})
      ),
      createPreloadEntry(
        'queries.search.searchDocumentTopics',
        { limit: 160 },
        queries.search.searchDocumentTopics({ limit: 160 })
      ),
      createPreloadEntry(
        'queries.common.userHashtags',
        { user_id: userId },
        queries.common.userHashtags({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.messages.conversationsForUnread',
        {},
        queries.messages.conversationsForUnread({})
      ),
    ];
  }, [userId]);

  useZeroPreloads(entries);
}

export function useRelationshipEntityPreloads() {
  const { user } = useAuth();
  const userId = user?.id;

  const entries = useMemo(() => {
    if (!userId) return [];

    return [
      createPreloadEntry(
        'queries.groups.currentUserActiveMembershipsWithGroups',
        {},
        queries.groups.currentUserActiveMembershipsWithGroups({})
      ),
      createPreloadEntry(
        'queries.events.currentUserActiveParticipationsWithEvents',
        {},
        queries.events.currentUserActiveParticipationsWithEvents({})
      ),
      createPreloadEntry(
        'queries.amendments.currentUserActiveCollaborationsWithAmendments',
        {},
        queries.amendments.currentUserActiveCollaborationsWithAmendments({})
      ),
      createPreloadEntry(
        'queries.amendments.currentUserOpenNavigationAmendments',
        {},
        queries.amendments.currentUserOpenNavigationAmendments({})
      ),
    ];
  }, [userId]);

  useZeroPreloads(entries);
}

export function useLikelyFirstRoutePreloads() {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    return [
      createPreloadEntry(
        'queries.search.searchDocumentPage',
        HOME_DISCOVER_SEARCH_ARGS,
        queries.search.searchDocumentPage(HOME_DISCOVER_SEARCH_ARGS)
      ),
    ];
  }, [user?.id]);

  useZeroPreloads(entries);
}

export function useGlobalZeroPreloads() {
  useCoreZeroPreloads();
  useRelationshipEntityPreloads();
  useLikelyFirstRoutePreloads();
}
