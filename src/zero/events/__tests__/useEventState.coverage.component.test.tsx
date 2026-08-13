/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = (name: string) => vi.fn((args?: unknown) => ({ name, args }));
  const eventNames = [
    'byId',
    'participants',
    'agenda',
    'delegates',
    'roles',
    'byGroup',
    'participantsByUser',
    'byIdFull',
    'forCancel',
    'withVoting',
    'streamEvent',
    'participantsWithUserAndRole',
    'offlineParticipants',
    'forParticipation',
    'userParticipation',
    'allParticipantsByEvent',
    'forRoles',
    'rolesWithHolders',
    'agendaWithElections',
    'agendaItemsFull',
    'agendaItemDetail',
    'delegatesFull',
    'groupRelationships',
    'delegateAssemblyComposition',
    'assemblyScopesByEvent',
    'delegateElectionAssignmentsByEvent',
    'subscribersByEvent',
    'wikiData',
    'wikiAgendaItems',
    'accessRolesByEvent',
    'byGroupActive',
    'all',
    'allAmendments',
    'rolesWithGroups',
    'userParticipationsWithEvent',
    'participantsByParticipatedEventIds',
    'withGroup',
    'electionWithVotes',
    'changeRequestsByAmendment',
    'forCalendar',
    'forCalendarWithExceptions',
    'byGroupForCalendar',
    'exceptionsByEvent',
    'withAgendaAndParticipants',
    'userSubscriptions',
  ];
  return {
    useQuery: vi.fn(),
    responses: new Map<string, readonly [any, { type: string }]>(),
    events: Object.fromEntries(eventNames.map(name => [name, query(name)])) as Record<
      string,
      ReturnType<typeof vi.fn>
    >,
    votes: { byAgendaItems: query('votesByAgendaItems') },
    deriveRelationships: vi.fn((rows: readonly unknown[]) => rows),
    parseMetadata: vi.fn((description?: string | null) =>
      description?.startsWith('meta') ? { mode: 'role_based', seatRoleIds: ['role-1'] } : null
    ),
    stripMetadata: vi.fn(
      (description?: string | null) => description?.replace('meta:', '') ?? null
    ),
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { name: string } | undefined) => mocks.useQuery(query),
}));
vi.mock('../../queries', () => ({
  queries: { events: mocks.events, votes: mocks.votes },
}));
vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  deriveNormalizedGroupRelationships: (rows: readonly unknown[]) => mocks.deriveRelationships(rows),
}));
vi.mock('@/features/elections/logic/electionAssignmentMetadata', () => ({
  parseDelegateElectionMetadata: (description?: string | null) => mocks.parseMetadata(description),
  stripDelegateElectionMetadata: (description?: string | null) => mocks.stripMetadata(description),
}));
vi.mock('@/features/elections/logic/electionMode', () => ({
  resolveElectionMode: (input: Record<string, unknown>) => input.electionMode ?? 'single',
  resolveElectionSeatCount: (input: Record<string, unknown>) =>
    input.seatCount ?? input.maxVotes ?? input.fallbackSeatCount ?? 1,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => (key.includes('description') ? 'description' : key),
}));

import {
  useAgendaItemDetail,
  useAgendaItemsByEvent,
  useAllAmendments,
  useAllEvents,
  useChangeRequestsByAmendment,
  useDelegateAssemblyCompositionData,
  useDelegateElectionAssignments,
  useElectionWithVotes,
  useEventAccessRoles,
  useEventAgenda,
  useEventAssemblyScopes,
  useEventById,
  useEventDelegates,
  useEventExceptions,
  useEventForCancel,
  useEventOfflineParticipants,
  useEventParticipantsByParticipatedEventIds,
  useEventParticipantsQuery,
  useEventParticipationData,
  useEventRolesData,
  useEventsByGroup,
  useEventsForCalendar,
  useEventsForCalendarWithExceptions,
  useEventState,
  useEventStreamData,
  useEventSubscribers,
  useEventWikiData,
  useEventWithAgendaAndParticipants,
  useEventWithGroup,
  useEventWithVoting,
  useGroupEventsForCalendar,
  useGroupRelationships,
  useRolesWithGroups,
  useUserEventParticipations,
  useUserEventSubscriptions,
} from '../useEventState';

function role(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Role ${id}`,
    sort_order: 1,
    holders: [{ id: `holder-${id}` }],
    ...overrides,
  };
}

function participant(id: string, status: string, overrides: Record<string, unknown> = {}) {
  return { id, status, participant_roles: [], ...overrides };
}

function election(id: string, overrides: Record<string, unknown> = {}) {
  return { id, description: 'meta:Election', role: role(`election-${id}`), ...overrides };
}

function setResponse(name: string, data: any, type = 'complete') {
  mocks.responses.set(name, [data, { type }]);
}

function useAllEventHooks() {
  return {
    state: useEventState({ eventId: 'event-1', groupId: 'group-1', userId: 'user-1' }),
    byId: useEventById('event-1'),
    cancel: useEventForCancel('event-1'),
    voting: useEventWithVoting('event-1'),
    stream: useEventStreamData('event-1'),
    participants: useEventParticipantsQuery('event-1'),
    offline: useEventOfflineParticipants('event-1'),
    participation: useEventParticipationData('event-1', 'user-1'),
    roles: useEventRolesData('event-1'),
    agenda: useEventAgenda('event-1'),
    agendaItems: useAgendaItemsByEvent('event-1'),
    agendaDetail: useAgendaItemDetail('agenda-1'),
    delegates: useEventDelegates('event-1', 'group-1'),
    composition: useDelegateAssemblyCompositionData('event-1'),
    scopes: useEventAssemblyScopes('event-1'),
    assignments: useDelegateElectionAssignments('event-1'),
    subscribers: useEventSubscribers('event-1'),
    wiki: useEventWikiData('event-1'),
    accessRoles: useEventAccessRoles('event-1'),
    byGroup: useEventsByGroup('group-1', 'excluded'),
    all: useAllEvents(),
    amendments: useAllAmendments(),
    rolesWithGroups: useRolesWithGroups(),
    userParticipations: useUserEventParticipations('user-1'),
    participatedEvents: useEventParticipantsByParticipatedEventIds([
      'event-1',
      '',
      'event-1',
      'event-2',
    ]),
    withGroup: useEventWithGroup('event-1'),
    relationships: useGroupRelationships('group-1'),
    election: useElectionWithVotes('election-1'),
    changeRequests: useChangeRequestsByAmendment('amendment-1'),
    calendar: useEventsForCalendar(),
    calendarExceptions: useEventsForCalendarWithExceptions(),
    groupCalendar: useGroupEventsForCalendar('group-1'),
    exceptions: useEventExceptions('event-1'),
    withAgenda: useEventWithAgendaAndParticipants('event-1'),
    subscriptions: useUserEventSubscriptions('user-1'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.responses.clear();
  mocks.useQuery.mockImplementation((query: { name: string } | undefined) =>
    query
      ? (mocks.responses.get(query.name) ?? [[], { type: 'complete' }])
      : [undefined, { type: 'complete' }]
  );

  const roles = [
    role('primary', { sort_order: 10, is_recurring: true, recurrence_pattern: 'yearly' }),
    role('history', {
      name: null,
      sort_order: null,
      holders: null,
      holder_history: [{ id: 'historic-holder' }],
      term_start_date: null,
    }),
    role('empty', { holders: null, holder_history: null, is_recurring: false }),
  ];
  const participants = [
    participant('active', 'active', {
      participant_roles: [{ role: roles[1] }, { role: null }, { role: roles[0] }],
      role: role('fallback'),
    }),
    participant('member', 'member', { role: role('fallback-only') }),
    participant('admin', 'admin'),
    participant('confirmed', 'confirmed'),
    participant('invited', 'invited'),
    participant('requested', 'requested'),
    participant('declined', 'declined'),
  ];
  const elections = [
    election('metadata'),
    election('null-role', { description: null, role: null, seat_count: 2 }),
    { id: 'plain', max_votes: 3 },
  ];
  const event = {
    id: 'event-1',
    subscriber_count: 7,
    participants,
    delegates: [{ id: 'delegate-1' }],
    agenda_items: [{ id: 'agenda-1', election: elections }],
    roles,
  };

  setResponse('byId', { id: 'event-1', subscriber_count: 7 });
  setResponse('participants', participants);
  setResponse('agenda', [{ id: 'agenda-1' }]);
  setResponse('delegates', [{ id: 'delegate-1' }]);
  setResponse('roles', roles);
  setResponse('byGroup', [{ id: 'event-1' }]);
  setResponse('participantsByUser', participants);
  setResponse('byIdFull', [event]);
  setResponse('forCancel', [event]);
  setResponse('withVoting', [event]);
  setResponse('streamEvent', [event]);
  setResponse('participantsWithUserAndRole', participants);
  setResponse('offlineParticipants', [{ id: 'offline-1' }]);
  setResponse('forParticipation', [event]);
  setResponse('userParticipation', [participants[0]]);
  setResponse('allParticipantsByEvent', participants);
  setResponse('forRoles', [event]);
  setResponse('rolesWithHolders', roles);
  setResponse('agendaWithElections', [{ id: 'agenda-1', election: elections }]);
  setResponse('agendaItemsFull', [
    { id: 'agenda-2', event: { id: 'event-1' }, order_index: 2, election: [], votes: [] },
    {
      id: 'agenda-1',
      event: { id: 'event-1' },
      order_index: null,
      election: elections,
      votes: [{ id: 'fallback-vote' }],
    },
    { id: 'other-event', event: { id: 'event-2' }, order_index: 1, election: [] },
  ]);
  setResponse('votesByAgendaItems', [
    { id: 'ignored-vote', agenda_item_id: null },
    { id: 'vote-1', agenda_item_id: 'agenda-2' },
    { id: 'vote-2', agenda_item_id: 'agenda-2' },
  ]);
  setResponse('agendaItemDetail', [
    { id: 'agenda-1', event: { id: 'event-1' }, election: elections },
  ]);
  setResponse('delegatesFull', [event]);
  setResponse('groupRelationships', [{ id: 'relationship-1' }]);
  setResponse('delegateAssemblyComposition', [
    {
      ...event,
      delegate_allocations: [
        { group: { roles: [{ elections }] } },
        { group: { roles: null } },
        { group: null },
      ],
    },
  ]);
  setResponse('assemblyScopesByEvent', [{ id: 'scope-1' }]);
  setResponse('delegateElectionAssignmentsByEvent', [{ id: 'assignment-1' }]);
  setResponse('subscribersByEvent', [{ id: 'subscriber-1' }]);
  setResponse('wikiData', [event]);
  setResponse('wikiAgendaItems', [{ id: 'agenda-1', election: elections }]);
  setResponse('accessRolesByEvent', roles);
  setResponse('byGroupActive', [
    { id: 'excluded', start_date: Date.now() + 10_000 },
    { id: 'past', start_date: Date.now() - 10_000, end_date: Date.now() - 5_000 },
    { id: 'future', start_date: Date.now() + 10_000, end_date: null },
    { id: 'missing-start', start_date: null, end_date: null },
  ]);
  setResponse('all', [event]);
  setResponse('allAmendments', [{ id: 'amendment-1' }]);
  setResponse('rolesWithGroups', roles);
  setResponse('userParticipationsWithEvent', participants);
  setResponse('participantsByParticipatedEventIds', participants);
  setResponse('withGroup', [event]);
  setResponse('electionWithVotes', elections);
  setResponse('changeRequestsByAmendment', [{ id: 'change-1' }]);
  setResponse('forCalendar', [event]);
  setResponse('forCalendarWithExceptions', [event]);
  setResponse('byGroupForCalendar', [event]);
  setResponse('exceptionsByEvent', [{ id: 'exception-1' }]);
  setResponse('withAgendaAndParticipants', [event]);
  setResponse('userSubscriptions', participants);
});

afterEach(cleanup);

describe('useEventState complete query contracts', () => {
  it('normalizes every event data facade with rich relation data', () => {
    const { result } = renderHook(() => useAllEventHooks());

    expect(result.current.byId.participantStats).toEqual({
      total: 7,
      members: 4,
      admins: 1,
      invited: 1,
      requested: 1,
    });
    expect(result.current.byId.participants[0]?.role?.id).toBe('primary');
    expect(result.current.byId.roles[1]?.holders).toEqual([{ id: 'historic-holder' }]);
    expect(result.current.participants.activeParticipants).toHaveLength(4);
    expect(result.current.participants.invitedParticipants).toHaveLength(1);
    expect(result.current.participants.requestedParticipants).toHaveLength(1);
    expect(result.current.agendaItems.agendaItems.map(item => item.id)).toEqual([
      'agenda-1',
      'agenda-2',
    ]);
    expect(result.current.agendaItems.agendaItems[1]?.votes).toHaveLength(2);
    expect(result.current.composition.scheduledElections).toHaveLength(3);
    expect(result.current.subscribers.subscriberCount).toBe(1);
    expect(result.current.byGroup.events.map(event => event.id)).toEqual(['future']);
    expect(result.current.participatedEvents.participants).toHaveLength(7);
    expect(mocks.events.participantsByParticipatedEventIds).toHaveBeenCalledWith({
      eventIds: ['event-1', 'event-2'],
    });
    expect(result.current.election.election).not.toBeNull();
  });

  it('normalizes absent query data and disables every optional query', () => {
    mocks.responses.clear();
    mocks.useQuery.mockImplementation((query: { name: string } | undefined) =>
      query ? [undefined, { type: 'complete' }] : [undefined, { type: 'complete' }]
    );

    const allAbsent = renderHook(() => useAllEventHooks()).result.current;
    expect(allAbsent.cancel.event).toBeNull();
    expect(allAbsent.voting.event).toBeNull();
    expect(allAbsent.composition.allocations).toEqual([]);
    expect(allAbsent.election.election).toBeNull();

    const defaults = renderHook(() => ({
      state: useEventState(),
      byId: useEventById(),
      participants: useEventParticipantsQuery(),
      offline: useEventOfflineParticipants(),
      agenda: useEventAgenda(),
      subscribers: useEventSubscribers(),
      byGroup: useEventsByGroup(),
      participations: useUserEventParticipations(),
      participated: useEventParticipantsByParticipatedEventIds(),
      relationships: useGroupRelationships(),
      changes: useChangeRequestsByAmendment(),
      groupCalendar: useGroupEventsForCalendar(),
      exceptions: useEventExceptions(),
      subscriptions: useUserEventSubscriptions(),
    })).result.current;

    expect(defaults.state.eventsByGroup).toEqual([]);
    expect(defaults.byId.event).toBeNull();
    expect(defaults.offline.isLoading).toBe(false);
    expect(defaults.participations.isLoading).toBe(false);
    expect(defaults.participated.isLoading).toBe(false);
    expect(defaults.subscribers.subscriberCount).toBe(0);
    expect(defaults.relationships.relationships).toEqual([]);
    expect(defaults.exceptions.exceptions).toEqual([]);
  });

  it('covers ongoing event filtering and subscriber-count fallback', () => {
    setResponse('byGroupActive', [
      { id: 'ongoing-end', start_date: Date.now() - 1000, end_date: Date.now() + 1000 },
      { id: 'ongoing-start', start_date: Date.now() + 1000, end_date: null },
      { id: 'missing-dates', start_date: null, end_date: null },
    ]);
    const ongoing = renderHook(() =>
      useEventsByGroup('group-1', undefined, { includeOngoing: true })
    ).result.current;
    expect(ongoing.events.map(event => event.id)).toEqual(['ongoing-end', 'ongoing-start']);

    setResponse('subscribersByEvent', undefined);
    const subscribers = renderHook(() => useEventSubscribers('event-1')).result.current;
    expect(subscribers.subscriberCount).toBe(7);
  });

  it('covers empty nested relation fallbacks on present rows', () => {
    const emptyEvent = {
      id: 'event-empty',
      participants: [
        { id: 'participant-empty', status: null, participant_roles: null, role: null },
        {
          id: 'participant-unsorted',
          status: 'active',
          participant_roles: [
            { role: { id: 'role-null', sort_order: null } },
            { role: { id: 'role-missing' } },
          ],
        },
      ],
      roles: null,
      agenda_items: null,
      delegates: null,
    };
    setResponse('byIdFull', [emptyEvent]);
    setResponse('withVoting', [emptyEvent]);
    setResponse('agendaWithElections', [{ id: 'agenda-empty', election: null }]);
    setResponse('agendaItemDetail', [{ id: 'agenda-empty', election: null }]);
    setResponse('delegateAssemblyComposition', [
      {
        ...emptyEvent,
        delegate_allocations: [{ group: { roles: [{ elections: null }] } }],
      },
    ]);
    setResponse('wikiData', [emptyEvent]);
    setResponse('wikiAgendaItems', [{ id: 'agenda-empty', election: null }]);
    setResponse('rolesWithHolders', undefined);

    const data = renderHook(() => useAllEventHooks()).result.current;
    expect(data.byId.roles).toEqual([]);
    expect(data.agenda.agendaItems[0]?.election).toEqual([]);
    expect(data.composition.scheduledElections).toEqual([]);
  });

  it('falls back from grouped votes to item votes and then an empty list', () => {
    setResponse('agendaItemsFull', [
      { id: 'agenda-fallback', event: { id: 'event-1' }, votes: [{ id: 'stored' }] },
      { id: 'agenda-empty', event: { id: 'event-1' } },
    ]);
    setResponse('votesByAgendaItems', []);

    const state = renderHook(() => useAgendaItemsByEvent('event-1')).result.current;
    expect(state.agendaItems[0]?.votes).toEqual([{ id: 'stored' }]);
    expect(state.agendaItems[1]?.votes).toEqual([]);
  });

  it.each([
    'byId',
    'participants',
    'agenda',
    'delegates',
    'roles',
    'byGroup',
    'participantsByUser',
  ])('reports aggregate state loading when %s is unresolved', name => {
    setResponse(name, [], 'unknown');
    expect(
      renderHook(() => useEventState({ eventId: 'e', groupId: 'g', userId: 'u' })).result.current
        .isLoading
    ).toBe(true);
  });

  it('reports dependent agenda loading only when vote loading is relevant', () => {
    setResponse('votesByAgendaItems', [], 'unknown');
    expect(renderHook(() => useAgendaItemsByEvent('event-1')).result.current.isLoading).toBe(true);

    setResponse('agendaItemsFull', []);
    expect(renderHook(() => useAgendaItemsByEvent('event-1')).result.current.isLoading).toBe(false);
  });
});
