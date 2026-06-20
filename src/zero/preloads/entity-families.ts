import { useEffect, useMemo, useState } from 'react';
import { useZero } from '@rocicorp/zero/react';
import type { TTL } from '@rocicorp/zero';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { createPreloadEntry, useZeroPreloads } from './preload-registry';
import {
  areEventAgendaPreloadDependenciesEqual,
  createEventAgendaBasePreloadEntries,
  createEventAgendaDependentPreloadEntries,
  discoverEventAgendaPreloadDependencies,
  EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES,
  eventAgendaPreloadDependenciesKey,
  extractCurrentUserParticipantEventIds,
  type EventAgendaPreloadDependencies,
} from './event-agenda';

interface RunnableZero {
  run: (
    query: unknown,
    options?: {
      type: 'unknown' | 'complete';
      ttl?: TTL;
    }
  ) => Promise<unknown>;
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function firstRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    return value[0] as Record<string, unknown> | undefined;
  }

  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function idRows(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return uniqueSorted(
    value.map(row =>
      row && typeof row === 'object' && 'id' in row ? String((row as { id: unknown }).id) : null
    )
  );
}

function shallowEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function eventAgendaDependenciesByEventKey(
  dependenciesByEventId: Record<string, EventAgendaPreloadDependencies>
) {
  return Object.keys(dependenciesByEventId)
    .sort()
    .map(
      eventId => `${eventId}:${eventAgendaPreloadDependenciesKey(dependenciesByEventId[eventId])}`
    )
    .join('|');
}

export function useGroupRouteFamilyPreloads(groupId?: string) {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const [eventIds, setEventIds] = useState<string[]>([]);

  const entries = useMemo(() => {
    if (!user?.id || !groupId) return [];

    return [
      createPreloadEntry(
        'queries.groups.byIdFull',
        { id: groupId },
        queries.groups.byIdFull({ id: groupId })
      ),
      createPreloadEntry(
        'queries.groups.activeMembersByGroup',
        { groupId },
        queries.groups.activeMembersByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.events.byGroupActive',
        { groupId },
        queries.events.byGroupActive({ groupId })
      ),
      createPreloadEntry(
        'queries.events.byGroupForCalendar',
        { groupId },
        queries.events.byGroupForCalendar({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.amendmentsByGroup',
        { groupId },
        queries.groups.amendmentsByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.blogs.byGroupWithHashtags',
        { group_id: groupId },
        queries.blogs.byGroupWithHashtags({ group_id: groupId })
      ),
      createPreloadEntry(
        'queries.statements.byGroup',
        { group_id: groupId },
        queries.statements.byGroup({ group_id: groupId })
      ),
      createPreloadEntry(
        'queries.groups.todosByGroup',
        { groupId },
        queries.groups.todosByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.linksByGroup',
        { groupId },
        queries.groups.linksByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.paymentsReceivedByGroup',
        { groupId },
        queries.groups.paymentsReceivedByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.paymentsPaidByGroup',
        { groupId },
        queries.groups.paymentsPaidByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.membershipsWithRolesAndRights',
        { groupId },
        queries.groups.membershipsWithRolesAndRights({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.guestAccessesWithRolesAndRights',
        { groupId },
        queries.groups.guestAccessesWithRolesAndRights({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.offlineMembershipsWithRolesAndRights',
        { groupId },
        queries.groups.offlineMembershipsWithRolesAndRights({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.byIdForNetwork',
        { id: groupId },
        queries.groups.byIdForNetwork({ id: groupId })
      ),
      createPreloadEntry(
        'queries.network.allGroupConnections',
        {},
        queries.network.allGroupConnections({})
      ),
      createPreloadEntry(
        'queries.groups.amendmentsWithDocuments',
        { groupId },
        queries.groups.amendmentsWithDocuments({ groupId })
      ),
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: groupId, entityType: 'group' },
        queries.notifications.byEntity({ entityId: groupId, entityType: 'group' })
      ),
      createPreloadEntry(
        'queries.common.groupHashtags',
        { group_id: groupId },
        queries.common.groupHashtags({ group_id: groupId })
      ),
      createPreloadEntry('queries.common.allHashtags', {}, queries.common.allHashtags({})),
      createPreloadEntry(
        'queries.messages.conversationByGroupId',
        { group_id: groupId },
        queries.messages.conversationByGroupId({ group_id: groupId })
      ),
    ];
  }, [groupId, user?.id]);

  const dependentEntries = useMemo(() => {
    if (!user?.id || eventIds.length === 0) return [];

    return [
      createPreloadEntry(
        'queries.groups.amendmentEventStepRunsByEventIds',
        { eventIds },
        queries.groups.amendmentEventStepRunsByEventIds({ eventIds })
      ),
    ];
  }, [eventIds, user?.id]);

  useZeroPreloads(entries);
  useZeroPreloads(dependentEntries);

  useEffect(() => {
    if (!user?.id || !groupId) {
      setEventIds([]);
      return;
    }

    let active = true;

    zero
      .run(queries.events.byGroupActive({ groupId }), { type: 'complete', ttl: 'none' })
      .then(rows => {
        if (!active) return;
        const nextEventIds = idRows(rows);
        setEventIds(previous => (shallowEqual(previous, nextEventIds) ? previous : nextEventIds));
      })
      .catch(error => {
        if (active)
          console.warn(`Zero dependent preload discovery failed for group ${groupId}`, error);
      });

    return () => {
      active = false;
    };
  }, [groupId, user?.id, zero]);
}

export function useEventRouteFamilyPreloads(eventId?: string) {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const [agendaDependencies, setAgendaDependencies] = useState<EventAgendaPreloadDependencies>(
    EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES
  );
  const [groupId, setGroupId] = useState<string | null>(null);

  const entries = useMemo(() => {
    if (!user?.id || !eventId) return [];

    const baseEntries = [
      createPreloadEntry(
        'queries.events.byIdFull',
        { id: eventId },
        queries.events.byIdFull({ id: eventId })
      ),
      ...createEventAgendaBasePreloadEntries(eventId),
      createPreloadEntry(
        'queries.events.participantsWithUserAndRole',
        { eventId },
        queries.events.participantsWithUserAndRole({ eventId })
      ),
      createPreloadEntry(
        'queries.events.offlineParticipants',
        { eventId },
        queries.events.offlineParticipants({ eventId })
      ),
      createPreloadEntry(
        'queries.events.accessRolesByEvent',
        { eventId },
        queries.events.accessRolesByEvent({ eventId })
      ),
      createPreloadEntry(
        'queries.events.delegateAssemblyComposition',
        { id: eventId },
        queries.events.delegateAssemblyComposition({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.assemblyScopesByEvent',
        { eventId },
        queries.events.assemblyScopesByEvent({ eventId })
      ),
      createPreloadEntry(
        'queries.events.delegateElectionAssignmentsByEvent',
        { eventId },
        queries.events.delegateElectionAssignmentsByEvent({ eventId })
      ),
      createPreloadEntry(
        'queries.events.streamEvent',
        { id: eventId },
        queries.events.streamEvent({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.forRoles',
        { id: eventId },
        queries.events.forRoles({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.rolesWithHolders',
        { eventId },
        queries.events.rolesWithHolders({ eventId })
      ),
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: eventId, entityType: 'event' },
        queries.notifications.byEntity({ entityId: eventId, entityType: 'event' })
      ),
      createPreloadEntry(
        'queries.events.forCancel',
        { id: eventId },
        queries.events.forCancel({ id: eventId })
      ),
    ];

    if (groupId) {
      baseEntries.push(
        createPreloadEntry(
          'queries.events.groupRelationships',
          { groupId },
          queries.events.groupRelationships({ groupId })
        )
      );
    }

    return baseEntries;
  }, [eventId, groupId, user?.id]);

  const dependentEntries = useMemo(() => {
    if (!user?.id) return [];

    return createEventAgendaDependentPreloadEntries(agendaDependencies);
  }, [agendaDependencies, user?.id]);

  useZeroPreloads(entries);
  useZeroPreloads(dependentEntries);

  useEffect(() => {
    if (!user?.id || !eventId) {
      setAgendaDependencies(EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES);
      setGroupId(null);
      return;
    }

    let active = true;

    Promise.all([
      zero.run(queries.events.agendaItemsFull({ eventId }), { type: 'complete', ttl: 'none' }),
      zero.run(queries.events.byIdFull({ id: eventId }), { type: 'complete', ttl: 'none' }),
    ])
      .then(([agendaRows, eventRows]) => {
        if (!active) return;

        const nextAgendaDependencies = discoverEventAgendaPreloadDependencies(agendaRows, user.id);
        setAgendaDependencies(previous =>
          areEventAgendaPreloadDependenciesEqual(previous, nextAgendaDependencies)
            ? previous
            : nextAgendaDependencies
        );

        const event = firstRow(eventRows);
        const nextGroupId = typeof event?.group_id === 'string' ? event.group_id : null;
        setGroupId(nextGroupId);
      })
      .catch(error => {
        if (active)
          console.warn(`Zero dependent preload discovery failed for event ${eventId}`, error);
      });

    return () => {
      active = false;
    };
  }, [eventId, user?.id, zero]);
}

export function useCurrentUserParticipantEventAgendaPreloads() {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [dependenciesByEventId, setDependenciesByEventId] = useState<
    Record<string, EventAgendaPreloadDependencies>
  >({});

  const eventIdsKey = eventIds.join('|');
  const dependenciesKey = eventAgendaDependenciesByEventKey(dependenciesByEventId);

  const entries = useMemo(() => {
    if (!user?.id) return [];

    return eventIds.flatMap(createEventAgendaBasePreloadEntries);
  }, [eventIds, eventIdsKey, user?.id]);

  const dependentEntries = useMemo(() => {
    if (!user?.id) return [];

    return Object.keys(dependenciesByEventId)
      .sort()
      .flatMap(eventId => createEventAgendaDependentPreloadEntries(dependenciesByEventId[eventId]));
  }, [dependenciesByEventId, dependenciesKey, user?.id]);

  useZeroPreloads(entries);
  useZeroPreloads(dependentEntries);

  useEffect(() => {
    if (!user?.id) {
      setEventIds([]);
      setDependenciesByEventId({});
      return;
    }

    let active = true;

    zero
      .run(queries.events.currentUserActiveParticipationsWithEvents({}), {
        type: 'complete',
        ttl: 'none',
      })
      .then(async participationRows => {
        if (!active) return;

        const nextEventIds = extractCurrentUserParticipantEventIds(participationRows);
        setEventIds(previous => (shallowEqual(previous, nextEventIds) ? previous : nextEventIds));

        const dependencyPairs = await Promise.all(
          nextEventIds.map(async discoveredEventId => {
            try {
              const agendaRows = await zero.run(
                queries.events.agendaItemsFull({ eventId: discoveredEventId }),
                {
                  type: 'complete',
                  ttl: 'none',
                }
              );
              return [
                discoveredEventId,
                discoverEventAgendaPreloadDependencies(agendaRows, user.id),
              ] as const;
            } catch (error) {
              console.warn(
                `Zero dependent preload discovery failed for participant event ${discoveredEventId}`,
                error
              );
              return [discoveredEventId, EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES] as const;
            }
          })
        );

        if (!active) return;

        const nextDependenciesByEventId = Object.fromEntries(dependencyPairs);
        setDependenciesByEventId(previous =>
          eventAgendaDependenciesByEventKey(previous) ===
          eventAgendaDependenciesByEventKey(nextDependenciesByEventId)
            ? previous
            : nextDependenciesByEventId
        );
      })
      .catch(error => {
        if (active) {
          console.warn('Zero participant event agenda preload discovery failed', error);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id, zero]);
}

export function useAmendmentRouteFamilyPreloads(amendmentId?: string) {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const [documentIds, setDocumentIds] = useState<string[]>([]);

  const entries = useMemo(() => {
    if (!user?.id || !amendmentId) return [];

    return [
      createPreloadEntry(
        'queries.amendments.byIdFull',
        { id: amendmentId },
        queries.amendments.byIdFull({ id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.byIdWithProcessData',
        { id: amendmentId },
        queries.amendments.byIdWithProcessData({ id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.byIdWithDocsAndCollabs',
        { id: amendmentId },
        queries.amendments.byIdWithDocsAndCollabs({ id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.documentsByAmendment',
        { amendment_id: amendmentId },
        queries.amendments.documentsByAmendment({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.changeRequestsWithVotes',
        { amendment_id: amendmentId },
        queries.amendments.changeRequestsWithVotes({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.collaborators',
        { amendment_id: amendmentId },
        queries.amendments.collaborators({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.rolesByAmendment',
        { amendment_id: amendmentId },
        queries.amendments.rolesByAmendment({ amendment_id: amendmentId })
      ),
      createPreloadEntry('queries.groups.allUsersLimited', {}, queries.groups.allUsersLimited({})),
      createPreloadEntry(
        'queries.amendments.threads',
        { amendment_id: amendmentId },
        queries.amendments.threads({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.streetDesigns',
        { amendment_id: amendmentId },
        queries.amendments.streetDesigns({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: amendmentId, entityType: 'amendment' },
        queries.notifications.byEntity({ entityId: amendmentId, entityType: 'amendment' })
      ),
      createPreloadEntry(
        'queries.amendments.byId',
        { id: amendmentId },
        queries.amendments.byId({ id: amendmentId })
      ),
    ];
  }, [amendmentId, user?.id]);

  const dependentEntries = useMemo(() => {
    if (!user?.id || documentIds.length === 0) return [];

    return documentIds.flatMap(documentId => [
      createPreloadEntry(
        'queries.amendments.documentById',
        { id: documentId },
        queries.amendments.documentById({ id: documentId })
      ),
      createPreloadEntry(
        'queries.documents.threads',
        { document_id: documentId },
        queries.documents.threads({ document_id: documentId })
      ),
      createPreloadEntry(
        'queries.documents.collaborators',
        { document_id: documentId },
        queries.documents.collaborators({ document_id: documentId })
      ),
      createPreloadEntry(
        'queries.amendments.documentVersionsByDocument',
        { document_id: documentId },
        queries.amendments.documentVersionsByDocument({ document_id: documentId })
      ),
    ]);
  }, [documentIds, user?.id]);

  useZeroPreloads(entries);
  useZeroPreloads(dependentEntries);

  useEffect(() => {
    if (!user?.id || !amendmentId) {
      setDocumentIds([]);
      return;
    }

    let active = true;

    zero
      .run(queries.amendments.documentsByAmendment({ amendment_id: amendmentId }), {
        type: 'complete',
        ttl: 'none',
      })
      .then(rows => {
        if (!active) return;
        const nextDocumentIds = idRows(rows);
        setDocumentIds(previous =>
          shallowEqual(previous, nextDocumentIds) ? previous : nextDocumentIds
        );
      })
      .catch(error => {
        if (active) {
          console.warn(
            `Zero dependent preload discovery failed for amendment ${amendmentId}`,
            error
          );
        }
      });

    return () => {
      active = false;
    };
  }, [amendmentId, user?.id, zero]);
}

export function useBlogRouteFamilyPreloads(blogId?: string) {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id || !blogId) return [];

    return [
      createPreloadEntry(
        'queries.blogs.byIdWithDetails',
        { id: blogId },
        queries.blogs.byIdWithDetails({ id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.entries',
        { blog_id: blogId },
        queries.blogs.entries({ blog_id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.byIdWithBloggers',
        { id: blogId },
        queries.blogs.byIdWithBloggers({ id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.byIdWithManagement',
        { id: blogId },
        queries.blogs.byIdWithManagement({ id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.byIdForEditor',
        { id: blogId },
        queries.blogs.byIdForEditor({ id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.versionsByBlogId',
        { blog_id: blogId },
        queries.blogs.versionsByBlogId({ blog_id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.blogThread',
        { blog_id: blogId },
        queries.blogs.blogThread({ blog_id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.subscribers',
        { blog_id: blogId },
        queries.blogs.subscribers({ blog_id: blogId })
      ),
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: blogId, entityType: 'blog' },
        queries.notifications.byEntity({ entityId: blogId, entityType: 'blog' })
      ),
    ];
  }, [blogId, user?.id]);

  useZeroPreloads(entries);
}

export function useUserRouteFamilyPreloads(userId?: string, isOwnUser = false) {
  const { user } = useAuth();

  const entries = useMemo(() => {
    if (!user?.id || !userId) return [];

    const baseEntries = [
      createPreloadEntry(
        'queries.users.fullProfile',
        { id: userId },
        queries.users.fullProfile({ id: userId })
      ),
      createPreloadEntry(
        'queries.common.userHashtags',
        { user_id: userId },
        queries.common.userHashtags({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.users.followers',
        { userId },
        queries.users.followers({ userId })
      ),
      createPreloadEntry(
        'queries.users.following',
        { userId },
        queries.users.following({ userId })
      ),
      createPreloadEntry(
        'queries.groups.membershipsByUser',
        { user_id: userId },
        queries.groups.membershipsByUser({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.events.userParticipationsWithEvent',
        { userId },
        queries.events.userParticipationsWithEvent({ userId })
      ),
      createPreloadEntry(
        'queries.amendments.collaboratorsByUser',
        { user_id: userId },
        queries.amendments.collaboratorsByUser({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.blogs.bloggersByUser',
        { user_id: userId },
        queries.blogs.bloggersByUser({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.common.userSubscriptions',
        { subscriber_id: userId },
        queries.common.userSubscriptions({ subscriber_id: userId })
      ),
      createPreloadEntry(
        'queries.common.userSubscribers',
        { user_id: userId },
        queries.common.userSubscribers({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.users.withGroupMemberships',
        { id: userId },
        queries.users.withGroupMemberships({ id: userId })
      ),
      createPreloadEntry(
        'queries.network.allGroupConnections',
        {},
        queries.network.allGroupConnections({})
      ),
      createPreloadEntry(
        'queries.calendarSubscriptions.byUserAndUser',
        { targetUserId: userId },
        queries.calendarSubscriptions.byUserAndUser({ targetUserId: userId })
      ),
      createPreloadEntry(
        'queries.events.byCreator',
        { userId },
        queries.events.byCreator({ userId })
      ),
    ];

    if (isOwnUser) {
      baseEntries.push(
        createPreloadEntry('queries.preferences.byUser', {}, queries.preferences.byUser({})),
        createPreloadEntry('queries.notifications.settings', {}, queries.notifications.settings({}))
      );
    }

    return baseEntries;
  }, [isOwnUser, user?.id, userId]);

  useZeroPreloads(entries);
}
