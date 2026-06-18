import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { type QueryRowType } from '@rocicorp/zero';
import {
  parseDelegateElectionMetadata,
  stripDelegateElectionMetadata,
} from '@/features/elections/logic/electionAssignmentMetadata';
import {
  resolveElectionMode,
  resolveElectionSeatCount,
} from '@/features/elections/logic/electionMode';
import { queries } from '../queries';
import { deriveNormalizedGroupRelationships } from '@/features/network/logic/groupConnectionDerived';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/** A single event row from the byGroup query (flat, no relations) */
export type EventByGroupRow = QueryRowType<typeof queries.events.byGroup>;
type EventByIdFullRow = QueryRowType<typeof queries.events.byIdFull>;
type EventAgendaWithElectionsRow = QueryRowType<typeof queries.events.agendaWithElections>;
type EventAgendaItemsFullRow = QueryRowType<typeof queries.events.agendaItemsFull>;
type EventAgendaItemDetailRow = QueryRowType<typeof queries.events.agendaItemDetail>;
type EventWikiDataRow = QueryRowType<typeof queries.events.wikiData>;
type EventWikiAgendaItemRow = QueryRowType<typeof queries.events.wikiAgendaItems>;
type EventDelegateAssemblyCompositionRow = QueryRowType<
  typeof queries.events.delegateAssemblyComposition
>;

interface EventStateOptions {
  eventId?: string;
  groupId?: string;
  userId?: string;
}

interface RoleDisplayLike {
  id: string;
  name?: string | null;
  description?: string | null;
  scope?: string | null;
  group_id?: string | null;
  event_id?: string | null;
  amendment_id?: string | null;
  blog_id?: string | null;
  assignee_kind?: string | null;
  assignment_mode?: string | null;
  visibility?: string | null;
  term_start_date?: number | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_rule?: string | null;
  recurrence_interval?: number | null;
  recurrence_days?: unknown;
  recurrence_end_date?: number | null;
  scheduled_revote_date?: number | null;
  default_request_role?: boolean | null;
  default_invite_role?: boolean | null;
  sort_order?: number | null;
  created_at?: number | null;
  holders?: readonly unknown[] | null;
  holder_history?: readonly unknown[] | null;
  elections?: readonly { status?: string | null }[] | null;
  action_rights?: readonly { resource: string | null; action: string | null }[];
  group?: { id: string; name?: string | null } | null;
}

type DisplayRole<TRole extends RoleDisplayLike = RoleDisplayLike> = TRole & {
  title: string | null;
  term: string | null;
  first_term_start: number | null;
  holders: readonly unknown[];
};

type ElectionWithDisplayRole<TElection extends object> = Omit<TElection, 'role'> & {
  role?: DisplayRole | null;
};

type AgendaItemWithDisplayRoles<TItem extends { election?: readonly unknown[] | null }> = Omit<
  TItem,
  'election'
> & {
  election: ElectionWithDisplayRole<Extract<NonNullable<TItem['election']>[number], object>>[];
};

type EventWithDisplayRoles<
  TEvent extends {
    roles?: readonly RoleDisplayLike[] | null;
    agenda_items?: readonly { election?: readonly unknown[] | null }[] | null;
  },
> = Omit<TEvent, 'roles' | 'agenda_items'> & {
  roles: DisplayRole<Extract<NonNullable<TEvent['roles']>[number], RoleDisplayLike>>[];
  agenda_items: AgendaItemWithDisplayRoles<
    Extract<
      NonNullable<TEvent['agenda_items']>[number],
      object & { election?: readonly unknown[] | null }
    >
  >[];
};

interface EventRoleLike {
  id: string;
  name?: string | null;
  description?: string | null;
  scope?: string | null;
  group_id?: string | null;
  event_id?: string | null;
  amendment_id?: string | null;
  blog_id?: string | null;
  assignee_kind?: string | null;
  assignment_mode?: string | null;
  visibility?: string | null;
  action_rights?: readonly { resource: string | null; action: string | null }[];
  sort_order?: number | null;
}

interface EventParticipantRoleLinkLike<TRole extends EventRoleLike = EventRoleLike> {
  role?: TRole | null;
}

function isActiveEventParticipantStatus(status: string | null | undefined) {
  return status === 'active' || status === 'member' || status === 'admin' || status === 'confirmed';
}

function selectPrimaryEventRole<TRole extends EventRoleLike>(roles: readonly TRole[]) {
  if (roles.length === 0) return null;

  return (
    [...roles].sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1))[0] ?? null
  );
}

function normalizeParticipantWithRoles<
  TParticipant extends {
    participant_roles?: readonly EventParticipantRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends EventRoleLike,
>(participant: TParticipant) {
  const roles: TRole[] = [];
  for (const link of participant.participant_roles || []) {
    if (link.role) {
      roles.push(link.role);
    }
  }
  const primaryRole = selectPrimaryEventRole(roles) ?? participant.role ?? null;

  return {
    ...participant,
    roles,
    role: primaryRole,
  };
}

function normalizeParticipants<
  TParticipant extends {
    participant_roles?: readonly EventParticipantRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends EventRoleLike,
>(participants: readonly TParticipant[] | null | undefined) {
  return (participants || []).map(participant => normalizeParticipantWithRoles(participant));
}

function mapRoleForDisplay<T extends RoleDisplayLike>(role: T): DisplayRole<T> {
  return {
    ...role,
    title: role.name ?? null,
    term:
      Boolean(role.is_recurring) && role.recurrence_pattern === 'yearly'
        ? String(role.recurrence_interval ?? 1)
        : null,
    first_term_start: role.term_start_date ?? null,
    holders: role.holders || role.holder_history || [],
  };
}

function mapElectionRole<T extends object>(election: T): ElectionWithDisplayRole<T> {
  const role =
    'role' in election ? (election as { role?: RoleDisplayLike | null }).role : undefined;
  const description =
    translateText('generated.inline.0193_description_cb329146') in election
      ? stripDelegateElectionMetadata((election as { description?: string | null }).description)
      : undefined;
  const delegateAssignmentMeta =
    'description' in election
      ? parseDelegateElectionMetadata((election as { description?: string | null }).description)
      : null;
  const rawElection = election as {
    election_mode?: string | null;
    seat_count?: number | null;
    max_votes?: number | null;
  };
  const electionMode = resolveElectionMode({
    electionMode: rawElection.election_mode,
    seatCount: rawElection.seat_count,
    maxVotes: rawElection.max_votes,
    delegateAssignmentMode: delegateAssignmentMeta?.mode ?? null,
  });
  const seatCount = resolveElectionSeatCount({
    electionMode,
    seatCount: rawElection.seat_count,
    maxVotes: rawElection.max_votes,
    fallbackSeatCount: delegateAssignmentMeta?.seatRoleIds.length ?? null,
    delegateAssignmentMode: delegateAssignmentMeta?.mode ?? null,
  });

  return {
    ...election,
    ...(description !== undefined ? { description } : {}),
    ...(delegateAssignmentMeta ? { delegate_assignment_meta: delegateAssignmentMeta } : {}),
    election_mode: electionMode,
    seat_count: seatCount,
    role: role ? mapRoleForDisplay(role) : (role ?? undefined),
  } as ElectionWithDisplayRole<T>;
}

function mapAgendaItemRoles<T extends { election?: readonly unknown[] | null }>(
  item: T
): AgendaItemWithDisplayRoles<T> {
  return {
    ...item,
    election: (item.election || []).map(election => mapElectionRole(election as object)),
  } as unknown as AgendaItemWithDisplayRoles<T>;
}

function mapEventRoles<
  T extends {
    roles?: readonly RoleDisplayLike[] | null;
    agenda_items?: readonly { election?: readonly unknown[] | null }[] | null;
  },
>(event: T): EventWithDisplayRoles<T> {
  return {
    ...event,
    roles: (event.roles || []).map(role => mapRoleForDisplay(role)),
    agenda_items: (event.agenda_items || []).map(item => mapAgendaItemRoles(item)),
  } as unknown as EventWithDisplayRoles<T>;
}

/**
 * Reactive state hook for event data.
 * Returns all query-derived state — no mutations.
 */
export function useEventState(options: EventStateOptions = {}) {
  const { eventId, groupId, userId } = options;

  const [event, eventResult] = useQuery(eventId ? queries.events.byId({ id: eventId }) : undefined);

  const [participants, participantsResult] = useQuery(
    eventId ? queries.events.participants({ eventId }) : undefined
  );

  const [agenda, agendaResult] = useQuery(eventId ? queries.events.agenda({ eventId }) : undefined);

  const [delegates, delegatesResult] = useQuery(
    eventId ? queries.events.delegates({ eventId }) : undefined
  );

  const [roles, rolesResult] = useQuery(eventId ? queries.events.roles({ eventId }) : undefined);

  // ── Events by group (opt-in) ───────────────────────────────────────
  const [eventsByGroup, eventsByGroupResult] = useQuery(
    groupId ? queries.events.byGroup({ groupId }) : undefined
  );

  // ── Participants by user (opt-in) ──────────────────────────────────
  const [participantsByUser, participantsByUserResult] = useQuery(
    userId ? queries.events.participantsByUser({ user_id: userId }) : undefined
  );

  const isLoading =
    (eventId !== undefined && eventResult.type === 'unknown') ||
    (eventId !== undefined && participantsResult.type === 'unknown') ||
    (eventId !== undefined && agendaResult.type === 'unknown') ||
    (eventId !== undefined && delegatesResult.type === 'unknown') ||
    (eventId !== undefined && rolesResult.type === 'unknown') ||
    (groupId !== undefined && eventsByGroupResult.type === 'unknown') ||
    (userId !== undefined && participantsByUserResult.type === 'unknown');

  return {
    event,
    participants: normalizeParticipants(participants),
    agenda,
    delegates,
    roles,
    eventsByGroup: eventsByGroup ?? [],
    participantsByUser: normalizeParticipants(participantsByUser),
    isLoading,
  };
}

// ── Focused Query Hooks ─────────────────────────────────────────────
// (Migrated from hooks.ts — each wraps a single formal query)

// ── Event Data ──────────────────────────────────────────────────────

export function useEventById(eventId?: string) {
  const [eventsData, eventsResult] = useQuery(
    eventId ? queries.events.byIdFull({ id: eventId }) : undefined
  );

  const isLoading = eventsResult.type === 'unknown';
  const event = useMemo(() => {
    const currentEvent = eventsData?.[0] as EventByIdFullRow | undefined;
    if (!currentEvent) return null;

    const mappedEvent = mapEventRoles<EventByIdFullRow>(currentEvent);

    return {
      ...mappedEvent,
      participants: normalizeParticipants(currentEvent.participants),
    };
  }, [eventsData]);
  const participants = useMemo(() => event?.participants || [], [event]);
  const delegates = useMemo(() => event?.delegates || [], [event]);
  const agendaItems = useMemo(() => event?.agenda_items || [], [event]);
  const roles = useMemo(
    () =>
      ((event?.roles ?? []) as DisplayRole[]).map(role => ({
        ...role,
        title: role.name ?? null,
        holders: role.holders || [],
      })),
    [event]
  );

  const participantStats = useMemo(() => {
    const stats = { total: participants.length, members: 0, admins: 0, invited: 0, requested: 0 };
    participants.forEach(p => {
      if (isActiveEventParticipantStatus(p.status)) stats.members++;
      if (p.status === 'admin') stats.admins++;
      if (p.status === 'invited') stats.invited++;
      if (p.status === 'requested') stats.requested++;
    });
    return stats;
  }, [participants]);

  return { event, participants, delegates, agendaItems, roles, participantStats, isLoading };
}

// ── Event with cancellation relations ───────────────────────────────

export function useEventForCancel(eventId: string) {
  const [eventsData, eventsResult] = useQuery(queries.events.forCancel({ id: eventId }));

  return {
    event: eventsData?.[0] || null,
    isLoading: eventsResult.type === 'unknown',
  };
}

// ── Event with voting sessions ──────────────────────────────────────

export function useEventWithVoting(eventId: string) {
  const [eventsData, eventsResult] = useQuery(queries.events.withVoting({ id: eventId }));

  return {
    event: eventsData?.[0]
      ? {
          ...eventsData[0],
          participants: normalizeParticipants(eventsData[0].participants),
        }
      : null,
    isLoading: eventsResult.type === 'unknown',
  };
}

// ── Event stream (full event + nested agenda) ───────────────────────

export function useEventStreamData(eventId: string) {
  const [eventsData, eventsResult] = useQuery(queries.events.streamEvent({ id: eventId }));

  return {
    event: eventsData?.[0] || null,
    isLoading: eventsResult.type === 'unknown',
  };
}

// ── Event Participants ──────────────────────────────────────────────

export function useEventParticipantsQuery(eventId?: string) {
  const [eventParticipants, participantsResult] = useQuery(
    eventId ? queries.events.participantsWithUserAndRole({ eventId }) : undefined
  );

  const isLoading = participantsResult.type === 'unknown';
  const participants = useMemo(() => normalizeParticipants(eventParticipants), [eventParticipants]);

  const { activeParticipants, invitedParticipants, requestedParticipants } = useMemo(() => {
    const active: typeof participants = [];
    const invited: typeof participants = [];
    const requested: typeof participants = [];
    participants.forEach(p => {
      if (isActiveEventParticipantStatus(p.status)) active.push(p);
      else if (p.status === 'invited') invited.push(p);
      else if (p.status === 'requested') requested.push(p);
    });
    return {
      activeParticipants: active,
      invitedParticipants: invited,
      requestedParticipants: requested,
    };
  }, [participants]);

  return {
    participants,
    activeParticipants,
    invitedParticipants,
    requestedParticipants,
    isLoading,
  };
}

export function useEventOfflineParticipants(eventId?: string) {
  const [offlineParticipantsData, offlineParticipantsResult] = useQuery(
    eventId ? queries.events.offlineParticipants({ eventId }) : undefined
  );

  return {
    offlineParticipants: offlineParticipantsData || [],
    isLoading: eventId != null && offlineParticipantsResult.type === 'unknown',
  };
}

// ── Event Participation (user-specific) ─────────────────────────────

export function useEventParticipationData(eventId: string, userId: string) {
  const [eventData, eventResult] = useQuery(queries.events.forParticipation({ id: eventId }));

  const [myParticipation, myParticipationResult] = useQuery(
    queries.events.userParticipation({ userId, eventId })
  );

  const [allParticipants, allParticipantsResult] = useQuery(
    queries.events.allParticipantsByEvent({ eventId })
  );

  return {
    event: eventData?.[0] || null,
    myParticipation: myParticipation?.[0]
      ? normalizeParticipantWithRoles(myParticipation[0])
      : null,
    allParticipants: normalizeParticipants(allParticipants),
    isLoading:
      eventResult.type === 'unknown' ||
      myParticipationResult.type === 'unknown' ||
      allParticipantsResult.type === 'unknown',
  };
}

// ── Event Roles ─────────────────────────────────────────────────────

export function useEventRolesData(eventId: string) {
  const [eventData, eventResult] = useQuery(queries.events.forRoles({ id: eventId }));

  const [rolesData, rolesResult] = useQuery(queries.events.rolesWithHolders({ eventId }));

  const roles = useMemo(
    () =>
      (rolesData || []).map(role => ({
        ...role,
        title: role.name,
        holders: role.holders || [],
      })),
    [rolesData]
  );

  return {
    event: eventData?.[0] || null,
    roles,
    isLoading: eventResult.type === 'unknown' || rolesResult.type === 'unknown',
  };
}

// ── Event Agenda ────────────────────────────────────────────────────

export function useEventAgenda(eventId?: string) {
  const [agendaItemsData, agendaResult] = useQuery(
    eventId ? queries.events.agendaWithElections({ eventId }) : undefined
  );

  return {
    agendaItems: useMemo(
      () =>
        (agendaItemsData || []).map(item => mapAgendaItemRoles<EventAgendaWithElectionsRow>(item)),
      [agendaItemsData]
    ),
    isLoading: agendaResult.type === 'unknown',
  };
}

// ── Agenda Items (full) ─────────────────────────────────────────────

export function useAgendaItemsByEvent(eventId: string) {
  const [agendaItemsData, agendaItemsResult] = useQuery(
    queries.events.agendaItemsFull({ eventId })
  );

  const agendaItemIds = useMemo(
    () => (agendaItemsData || []).map(item => item.id),
    [agendaItemsData]
  );

  const [votesByAgendaItems, votesByAgendaItemsResult] = useQuery(
    agendaItemIds.length > 0
      ? queries.votes.byAgendaItems({ agenda_item_ids: agendaItemIds })
      : undefined
  );

  const votesByAgendaItemId = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof votesByAgendaItems>[number][]>();

    for (const vote of votesByAgendaItems || []) {
      if (!vote.agenda_item_id) continue;

      const existingVotes = grouped.get(vote.agenda_item_id) ?? [];
      grouped.set(vote.agenda_item_id, [...existingVotes, vote]);
    }

    return grouped;
  }, [votesByAgendaItems]);

  const agendaItems = (agendaItemsData || [])
    .filter(item => item.event?.id === eventId)
    .map(item => ({
      ...mapAgendaItemRoles<EventAgendaItemsFullRow>(item),
      votes: votesByAgendaItemId.get(item.id) ?? item.votes ?? [],
    }))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  return {
    agendaItems,
    isLoading:
      agendaItemsResult.type === 'unknown' ||
      (agendaItemIds.length > 0 && votesByAgendaItemsResult.type === 'unknown'),
  };
}

// ── Single Agenda Item Detail ───────────────────────────────────────

export function useAgendaItemDetail(agendaItemId: string) {
  const [agendaItemsData, agendaItemsResult] = useQuery(
    queries.events.agendaItemDetail({ id: agendaItemId })
  );

  const agendaItem = agendaItemsData?.[0];

  return {
    agendaItem: agendaItem ? mapAgendaItemRoles<EventAgendaItemDetailRow>(agendaItem) : agendaItem,
    event: agendaItem?.event,
    isLoading: agendaItemsResult.type === 'unknown',
  };
}

// ── Event Delegates ─────────────────────────────────────────────────

export function useEventDelegates(eventId: string, groupId?: string) {
  const [eventData, eventResult] = useQuery(queries.events.delegatesFull({ id: eventId }));

  const [relationshipLinks, relationshipsResult] = useQuery(
    queries.events.groupRelationships({ groupId })
  );
  const relationships = useMemo(
    () => deriveNormalizedGroupRelationships(relationshipLinks ?? []),
    [relationshipLinks]
  );

  return {
    event: eventData?.[0] || null,
    relationships: relationships || [],
    isLoading: eventResult.type === 'unknown' || relationshipsResult.type === 'unknown',
  };
}

export function useDelegateAssemblyCompositionData(eventId: string) {
  const [eventData, eventResult] = useQuery(
    queries.events.delegateAssemblyComposition({ id: eventId })
  );
  const event = (eventData?.[0] as EventDelegateAssemblyCompositionRow | undefined) || null;
  const scheduledElections = useMemo(
    () =>
      (event?.delegate_allocations || []).flatMap(allocation =>
        (allocation.group?.roles || []).flatMap(role => role.elections || [])
      ),
    [event]
  );

  return {
    event,
    allocations: event?.delegate_allocations || [],
    delegates: event?.delegates || [],
    scheduledElections,
    isLoading: eventResult.type === 'unknown',
  };
}

export function useEventAssemblyScopes(eventId: string) {
  const [scopes, result] = useQuery(queries.events.assemblyScopesByEvent({ eventId }));

  return {
    scopes: scopes || [],
    isLoading: result.type === 'unknown',
  };
}

export function useDelegateElectionAssignments(eventId: string) {
  const [assignments, result] = useQuery(
    queries.events.delegateElectionAssignmentsByEvent({ eventId })
  );

  return {
    assignments: assignments || [],
    isLoading: result.type === 'unknown',
  };
}

// ── Additional hooks ────────────────────────────────────────────────

export function useEventSubscribers(eventId?: string) {
  const [eventRows, eventResult] = useQuery(
    eventId ? queries.events.byId({ id: eventId }) : undefined
  );

  const [subscribersData, subscribersResult] = useQuery(
    eventId ? queries.events.subscribersByEvent({ eventId }) : undefined
  );

  const subscriberCount = subscribersData?.length ?? eventRows?.subscriber_count ?? 0;

  return {
    event: eventRows || null,
    subscriberCount,
    subscribers: subscribersData || [],
    isLoading: eventResult.type === 'unknown' || subscribersResult.type === 'unknown',
  };
}

export function useEventWikiData(eventId: string) {
  const [events] = useQuery(queries.events.wikiData({ id: eventId }));

  const [agendaItemRows] = useQuery(queries.events.wikiAgendaItems({ eventId }));

  return {
    event: events?.[0] ? mapEventRoles<EventWikiDataRow>(events[0]) : null,
    agendaItems: (agendaItemRows || []).map(item =>
      mapAgendaItemRoles<EventWikiAgendaItemRow>(item)
    ),
  };
}

export function useEventAccessRoles(eventId: string) {
  const [eventRoles] = useQuery(queries.events.accessRolesByEvent({ eventId }));

  return { roles: eventRoles || [] };
}

export function useEventsByGroup(
  groupId?: string,
  excludeEventId?: string,
  options?: { includeOngoing?: boolean }
) {
  const [eventsData, eventsResult] = useQuery(
    groupId ? queries.events.byGroupActive({ groupId }) : undefined
  );

  const now = Date.now();

  const events = (eventsData || []).filter(
    e =>
      e.id !== excludeEventId &&
      (options?.includeOngoing
        ? (e.end_date ?? e.start_date ?? 0) >= now
        : (e.start_date ?? 0) > now)
  );

  return {
    events,
    rawEvents: eventsData || [],
    queryState: eventsResult.type,
    queryArgs: {
      groupId,
      excludeEventId,
      includeOngoing: options?.includeOngoing ?? false,
    },
  };
}

export function useAllEvents() {
  const [events] = useQuery(queries.events.all({}));
  return { events: events || [] };
}

export function useAllAmendments() {
  const [amendments] = useQuery(queries.events.allAmendments({}));
  return { amendments: amendments || [] };
}

export function useRolesWithGroups() {
  const [roles] = useQuery(queries.events.rolesWithGroups({}));
  const mappedRoles = useMemo(
    () => (roles || []).map(role => mapRoleForDisplay(role as RoleDisplayLike)),
    [roles]
  );
  return {
    roles: mappedRoles,
  };
}

export function useUserEventParticipations(userId?: string) {
  const [participations] = useQuery(
    userId ? queries.events.userParticipationsWithEvent({ userId }) : undefined
  );

  return {
    participations: participations || [],
    isLoading: !participations && !!userId,
  };
}

export function useEventParticipantsByParticipatedEventIds(eventIds?: readonly string[]) {
  const normalizedEventIds = useMemo(
    () => (eventIds ? [...new Set(eventIds.filter(Boolean))] : []),
    [eventIds]
  );
  const [participantsData, participantsResult] = useQuery(
    normalizedEventIds.length > 0
      ? queries.events.participantsByParticipatedEventIds({ eventIds: normalizedEventIds })
      : undefined
  );

  return {
    participants: participantsData || [],
    isLoading: normalizedEventIds.length > 0 && participantsResult.type === 'unknown',
  };
}

export function useEventWithGroup(eventId: string) {
  const [eventRows] = useQuery(queries.events.withGroup({ id: eventId }));
  return { event: eventRows?.[0] || null };
}

export function useGroupRelationships(groupId?: string) {
  const [relationshipLinks] = useQuery(queries.events.groupRelationships({ groupId }));

  return {
    relationships: deriveNormalizedGroupRelationships(relationshipLinks ?? []),
  };
}

export function useElectionWithVotes(electionId: string) {
  const [electionsData, electionsResult] = useQuery(
    queries.events.electionWithVotes({ id: electionId })
  );

  return {
    election: electionsData?.[0] ? mapElectionRole(electionsData[0]) : null,
    isLoading: electionsResult.type === 'unknown',
  };
}

export function useChangeRequestsByAmendment(amendmentId?: string) {
  const [changeRequests, result] = useQuery(
    amendmentId ? queries.events.changeRequestsByAmendment({ amendmentId }) : undefined
  );

  return {
    changeRequests: changeRequests || [],
    isLoading: result.type === 'unknown',
  };
}

export function useEventsForCalendar() {
  const [events] = useQuery(queries.events.forCalendar({}));

  return { events: events || [] };
}

export function useEventsForCalendarWithExceptions() {
  const [events] = useQuery(queries.events.forCalendarWithExceptions({}));

  return { events: events || [] };
}

export function useGroupEventsForCalendar(groupId?: string) {
  const [events] = useQuery(groupId ? queries.events.byGroupForCalendar({ groupId }) : undefined);

  return { events: events || [] };
}

export function useEventExceptions(eventId?: string) {
  const [exceptions] = useQuery(
    eventId ? queries.events.exceptionsByEvent({ eventId }) : undefined
  );

  return { exceptions: exceptions ?? [] };
}

export function useEventWithAgendaAndParticipants(eventId: string) {
  const [eventsData, eventsResult] = useQuery(
    queries.events.withAgendaAndParticipants({ id: eventId })
  );

  return {
    event: eventsData?.[0] || null,
    isLoading: eventsResult.type === 'unknown',
  };
}

// ── User Event Subscriptions (for timeline) ─────────────────────────

export function useUserEventSubscriptions(userId?: string) {
  const [participations, result] = useQuery(
    userId ? queries.events.userSubscriptions({ userId }) : undefined
  );

  return {
    participations: participations ?? [],
    isLoading: result.type === 'unknown',
  };
}
