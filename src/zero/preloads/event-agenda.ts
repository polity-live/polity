import { queries } from '@/zero/queries';
import { createPreloadEntry, stableStringify, type ZeroPreloadEntry } from './preload-registry';

type RowLike = Record<string, unknown>;

interface UserElectionParticipationPreloadArgs {
  election_id: string;
  elector_id: string;
}

interface UserVoteParticipationPreloadArgs {
  vote_id: string;
  voter_id: string;
}

export interface EventAgendaPreloadDependencies {
  agendaItemIds: string[];
  electionIds: string[];
  voteIds: string[];
  userElectionParticipations: UserElectionParticipationPreloadArgs[];
  userVoteParticipations: UserVoteParticipationPreloadArgs[];
}

export const EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES: EventAgendaPreloadDependencies = {
  agendaItemIds: [],
  electionIds: [],
  voteIds: [],
  userElectionParticipations: [],
  userVoteParticipations: [],
};

function asRow(value: unknown): RowLike | null {
  return value && typeof value === 'object' ? (value as RowLike) : null;
}

function asRows(value: unknown): RowLike[] {
  if (!Array.isArray(value)) return [];

  const rows: RowLike[] = [];
  for (const item of value) {
    const row = asRow(item);
    if (row) rows.push(row);
  }
  return rows;
}

function getString(row: RowLike | null | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getRelatedRows(row: RowLike, key: string): RowLike[] {
  const value = row[key];
  if (Array.isArray(value)) {
    return asRows(value);
  }

  const relatedRow = asRow(value);
  return relatedRow ? [relatedRow] : [];
}

function uniqueSorted(values: Iterable<string | null | undefined>): string[] {
  return Array.from(
    new Set(Array.from(values).filter((value): value is string => Boolean(value)))
  ).sort();
}

function uniqueSortedArgs<T>(values: T[], keyOf: (value: T) => string): T[] {
  return Array.from(new Map(values.map(value => [keyOf(value), value])).values()).sort((a, b) =>
    keyOf(a).localeCompare(keyOf(b))
  );
}

function getRelatedUserId(row: RowLike): string | null {
  return getString(row, 'user_id') ?? getString(asRow(row.user), 'id');
}

export function discoverEventAgendaPreloadDependencies(
  agendaRows: unknown,
  userId?: string
): EventAgendaPreloadDependencies {
  const agendaItems = asRows(agendaRows);
  if (agendaItems.length === 0) {
    return EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES;
  }

  const agendaItemIds: string[] = [];
  const electionIds: string[] = [];
  const voteIds: string[] = [];
  const userElectionParticipations: UserElectionParticipationPreloadArgs[] = [];
  const userVoteParticipations: UserVoteParticipationPreloadArgs[] = [];

  for (const agendaItem of agendaItems) {
    const agendaItemId = getString(agendaItem, 'id');
    if (agendaItemId) {
      agendaItemIds.push(agendaItemId);
    }

    for (const election of getRelatedRows(agendaItem, 'election')) {
      const electionId = getString(election, 'id');
      if (!electionId) continue;

      electionIds.push(electionId);

      if (userId) {
        const elector = getRelatedRows(election, 'electors').find(
          candidate => getRelatedUserId(candidate) === userId
        );
        const electorId = getString(elector, 'id');
        if (electorId) {
          userElectionParticipations.push({ election_id: electionId, elector_id: electorId });
        }
      }
    }

    for (const vote of getRelatedRows(agendaItem, 'votes')) {
      const voteId = getString(vote, 'id');
      if (!voteId) continue;

      voteIds.push(voteId);

      if (userId) {
        const voter = getRelatedRows(vote, 'voters').find(
          candidate => getRelatedUserId(candidate) === userId
        );
        const voterId = getString(voter, 'id');
        if (voterId) {
          userVoteParticipations.push({ vote_id: voteId, voter_id: voterId });
        }
      }
    }
  }

  return {
    agendaItemIds: uniqueSorted(agendaItemIds),
    electionIds: uniqueSorted(electionIds),
    voteIds: uniqueSorted(voteIds),
    userElectionParticipations: uniqueSortedArgs(
      userElectionParticipations,
      args => `${args.election_id}:${args.elector_id}`
    ),
    userVoteParticipations: uniqueSortedArgs(
      userVoteParticipations,
      args => `${args.vote_id}:${args.voter_id}`
    ),
  };
}

export function eventAgendaPreloadDependenciesKey(
  dependencies: EventAgendaPreloadDependencies
): string {
  return stableStringify(dependencies);
}

export function areEventAgendaPreloadDependenciesEqual(
  left: EventAgendaPreloadDependencies,
  right: EventAgendaPreloadDependencies
): boolean {
  return eventAgendaPreloadDependenciesKey(left) === eventAgendaPreloadDependenciesKey(right);
}

export function extractCurrentUserParticipantEventIds(participationRows: unknown): string[] {
  return uniqueSorted(
    asRows(participationRows).map(participation => {
      return getString(asRow(participation.event), 'id') ?? getString(participation, 'event_id');
    })
  );
}

export function createEventAgendaBasePreloadEntries(eventId: string): ZeroPreloadEntry[] {
  return [
    createPreloadEntry(
      'queries.events.agendaWithElections',
      { eventId },
      queries.events.agendaWithElections({ eventId })
    ),
    createPreloadEntry(
      'queries.events.agendaItemsFull',
      { eventId },
      queries.events.agendaItemsFull({ eventId })
    ),
    createPreloadEntry(
      'queries.agendas.byEvent',
      { event_id: eventId },
      queries.agendas.byEvent({ event_id: eventId })
    ),
    createPreloadEntry(
      'queries.events.withAgendaAndParticipants',
      { id: eventId },
      queries.events.withAgendaAndParticipants({ id: eventId })
    ),
  ];
}

export function createEventAgendaDependentPreloadEntries(
  dependencies: EventAgendaPreloadDependencies
): ZeroPreloadEntry[] {
  const entries: ZeroPreloadEntry[] = [];

  for (const agendaItemId of dependencies.agendaItemIds) {
    entries.push(
      createPreloadEntry(
        'queries.events.agendaItemDetail',
        { id: agendaItemId },
        queries.events.agendaItemDetail({ id: agendaItemId })
      ),
      createPreloadEntry(
        'queries.elections.byAgendaItem',
        { agenda_item_id: agendaItemId },
        queries.elections.byAgendaItem({ agenda_item_id: agendaItemId })
      ),
      createPreloadEntry(
        'queries.votes.byAgendaItem',
        { agenda_item_id: agendaItemId },
        queries.votes.byAgendaItem({ agenda_item_id: agendaItemId })
      ),
      createPreloadEntry(
        'queries.agendas.changeRequestTimeline',
        { agenda_item_id: agendaItemId },
        queries.agendas.changeRequestTimeline({ agenda_item_id: agendaItemId })
      ),
      createPreloadEntry(
        'queries.amendments.agendaItemForwardingContext',
        { agenda_item_id: agendaItemId },
        queries.amendments.agendaItemForwardingContext({ agenda_item_id: agendaItemId })
      )
    );
  }

  if (dependencies.agendaItemIds.length > 0) {
    entries.push(
      createPreloadEntry(
        'queries.votes.byAgendaItems',
        { agenda_item_ids: dependencies.agendaItemIds },
        queries.votes.byAgendaItems({ agenda_item_ids: dependencies.agendaItemIds })
      )
    );
  }

  for (const electionId of dependencies.electionIds) {
    entries.push(
      createPreloadEntry(
        'queries.elections.candidatesByElection',
        { election_id: electionId },
        queries.elections.candidatesByElection({ election_id: electionId })
      ),
      createPreloadEntry(
        'queries.elections.electorsByElection',
        { election_id: electionId },
        queries.elections.electorsByElection({ election_id: electionId })
      )
    );
  }

  for (const voteId of dependencies.voteIds) {
    entries.push(
      createPreloadEntry(
        'queries.votes.choicesByVote',
        { vote_id: voteId },
        queries.votes.choicesByVote({ vote_id: voteId })
      )
    );
  }

  for (const args of dependencies.userElectionParticipations) {
    entries.push(
      createPreloadEntry(
        'queries.elections.userIndicativeParticipation',
        args,
        queries.elections.userIndicativeParticipation(args)
      ),
      createPreloadEntry(
        'queries.elections.userFinalParticipation',
        args,
        queries.elections.userFinalParticipation(args)
      )
    );
  }

  for (const args of dependencies.userVoteParticipations) {
    entries.push(
      createPreloadEntry(
        'queries.votes.userIndicativeParticipation',
        args,
        queries.votes.userIndicativeParticipation(args)
      ),
      createPreloadEntry(
        'queries.votes.userFinalParticipation',
        args,
        queries.votes.userFinalParticipation(args)
      )
    );
  }

  return entries;
}
