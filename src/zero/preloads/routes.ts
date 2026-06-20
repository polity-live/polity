import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { createPreloadEntry, useZeroPreloads } from './preload-registry';
import {
  createSearchDocumentPageArgs,
  HOME_DISCOVER_SEARCH_ARGS,
  type SearchRoutePreloadParams,
} from './search-context';

export function useHomePreloads() {
  const { user } = useAuth();
  const userId = user?.id;

  const entries = useMemo(() => {
    if (!userId) return [];

    return [
      createPreloadEntry(
        'queries.search.searchDocumentPage',
        HOME_DISCOVER_SEARCH_ARGS,
        queries.search.searchDocumentPage(HOME_DISCOVER_SEARCH_ARGS)
      ),
      createPreloadEntry(
        'queries.common.userSubscriptionsForTimeline',
        { subscriber_id: userId },
        queries.common.userSubscriptionsForTimeline({ subscriber_id: userId })
      ),
      createPreloadEntry('queries.votes.votesWithDetails', {}, queries.votes.votesWithDetails({})),
      createPreloadEntry(
        'queries.elections.electionsWithDetails',
        {},
        queries.elections.electionsWithDetails({})
      ),
    ];
  }, [userId]);

  useZeroPreloads(entries);
}

export function useMessagesPreloads(selectedConversationId?: string) {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    const routeEntries = [
      createPreloadEntry(
        'queries.messages.conversationsWithRelations',
        { limit: 40 },
        queries.messages.conversationsWithRelations({ limit: 40 })
      ),
    ];

    if (selectedConversationId) {
      routeEntries.push(
        createPreloadEntry(
          'queries.messages.messagesWindow',
          { conversation_id: selectedConversationId, limit: 80 },
          queries.messages.messagesWindow({
            conversation_id: selectedConversationId,
            limit: 80,
          })
        ),
        createPreloadEntry(
          'queries.messages.conversationById',
          { id: selectedConversationId },
          queries.messages.conversationById({ id: selectedConversationId })
        )
      );
    }

    return routeEntries;
  }, [selectedConversationId, user?.id]);

  useZeroPreloads(entries);
}

export function useSearchPreloads(search: SearchRoutePreloadParams) {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    const args = createSearchDocumentPageArgs(search);

    return [
      createPreloadEntry(
        'queries.search.searchDocumentPage',
        args,
        queries.search.searchDocumentPage(args)
      ),
    ];
  }, [
    search.engagement,
    search.hashtag,
    search.q,
    search.range,
    search.sort,
    search.topics,
    search.types,
    user?.id,
  ]);

  useZeroPreloads(entries);
}

export function useCalendarPreloads() {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    return [
      createPreloadEntry(
        'queries.events.forCalendarWithExceptions',
        {},
        queries.events.forCalendarWithExceptions({})
      ),
    ];
  }, [user?.id]);

  useZeroPreloads(entries);
}

export function useTodosPreloads() {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    return [
      createPreloadEntry('queries.todos.allWithRelations', {}, queries.todos.allWithRelations({})),
    ];
  }, [user?.id]);

  useZeroPreloads(entries);
}

export function useNotificationsPreloads() {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    return [
      createPreloadEntry(
        'queries.notifications.byUserWithRelations',
        {},
        queries.notifications.byUserWithRelations({})
      ),
    ];
  }, [user?.id]);

  useZeroPreloads(entries);
}

export function useCreatePreloads() {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id) return [];

    return [
      createPreloadEntry('queries.common.allHashtags', {}, queries.common.allHashtags({})),
      createPreloadEntry(
        'queries.groups.currentUserMembershipsWithGroups',
        {},
        queries.groups.currentUserMembershipsWithGroups({})
      ),
      createPreloadEntry(
        'queries.groups.currentUserMembershipsWithRights',
        {},
        queries.groups.currentUserMembershipsWithRights({})
      ),
    ];
  }, [user?.id]);

  useZeroPreloads(entries);
}

export function useCreateEventPreloads(groupId?: string) {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id || !groupId) return [];

    return [
      createPreloadEntry(
        'queries.amendments.openProcessTasksByGroup',
        { group_id: groupId },
        queries.amendments.openProcessTasksByGroup({ group_id: groupId })
      ),
      createPreloadEntry(
        'queries.groups.byIdBasic',
        { id: groupId },
        queries.groups.byIdBasic({ id: groupId })
      ),
    ];
  }, [groupId, user?.id]);

  useZeroPreloads(entries);
}
