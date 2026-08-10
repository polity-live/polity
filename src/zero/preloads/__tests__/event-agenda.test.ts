import { describe, expect, it } from 'vitest';
import {
  areEventAgendaPreloadDependenciesEqual,
  createEventAgendaBasePreloadEntries,
  createEventAgendaDependentPreloadEntries,
  discoverEventAgendaPreloadDependencies,
  EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES,
  eventAgendaPreloadDependenciesKey,
  extractCurrentUserParticipantEventIds,
} from '../event-agenda';

describe('event agenda preloads', () => {
  it('discovers deduplicated agenda, vote, election, and current-user participation dependencies', () => {
    const dependencies = discoverEventAgendaPreloadDependencies(
      [
        {
          id: 'agenda-2',
          election: [
            {
              id: 'election-b',
              electors: [
                { id: 'elector-other', user_id: 'other-user' },
                { id: 'elector-b', user: { id: 'user-1' } },
              ],
            },
          ],
          votes: [
            {
              id: 'vote-b',
              voters: [{ id: 'voter-b', user_id: 'user-1' }],
            },
          ],
        },
        {
          id: 'agenda-1',
          election: [
            {
              id: 'election-a',
              electors: [{ id: 'elector-a', user_id: 'user-1' }],
            },
            {
              id: 'election-b',
              electors: [],
            },
          ],
          votes: [
            {
              id: 'vote-a',
              voters: [{ id: 'voter-a', user: { id: 'user-1' } }],
            },
            {
              id: 'vote-b',
              voters: [{ id: 'voter-other', user_id: 'other-user' }],
            },
          ],
        },
      ],
      'user-1'
    );

    expect(dependencies).toEqual({
      agendaItemIds: ['agenda-1', 'agenda-2'],
      electionIds: ['election-a', 'election-b'],
      voteIds: ['vote-a', 'vote-b'],
      userElectionParticipations: [
        { election_id: 'election-a', elector_id: 'elector-a' },
        { election_id: 'election-b', elector_id: 'elector-b' },
      ],
      userVoteParticipations: [
        { vote_id: 'vote-a', voter_id: 'voter-a' },
        { vote_id: 'vote-b', voter_id: 'voter-b' },
      ],
    });
  });

  it('ignores empty rows and omits user participation dependencies without a current user', () => {
    expect(discoverEventAgendaPreloadDependencies(null, 'user-1')).toEqual(
      EMPTY_EVENT_AGENDA_PRELOAD_DEPENDENCIES
    );

    expect(
      discoverEventAgendaPreloadDependencies(
        [
          {
            id: 'agenda-1',
            election: [{ id: 'election-1', electors: [{ id: 'elector-1', user_id: 'user-1' }] }],
            votes: [{ id: 'vote-1', voters: [{ id: 'voter-1', user_id: 'user-1' }] }],
          },
        ],
        undefined
      )
    ).toEqual({
      agendaItemIds: ['agenda-1'],
      electionIds: ['election-1'],
      voteIds: ['vote-1'],
      userElectionParticipations: [],
      userVoteParticipations: [],
    });
  });

  it('ignores malformed, singular, missing-id, and unmatched relationship rows', () => {
    const dependencies = discoverEventAgendaPreloadDependencies(
      [
        null,
        'invalid',
        {
          id: '',
          election: { id: 'election-1', electors: { id: '', user_id: 'user-1' } },
          votes: { id: 'vote-1', voters: { id: '', user: { id: 'user-1' } } },
        },
        {
          election: [{ electors: [] }],
          votes: [{ voters: [] }],
        },
        { election: 42, votes: 42 },
      ],
      'user-1'
    );
    expect(dependencies).toEqual({
      agendaItemIds: [],
      electionIds: ['election-1'],
      voteIds: ['vote-1'],
      userElectionParticipations: [],
      userVoteParticipations: [],
    });
    expect(createEventAgendaDependentPreloadEntries(dependencies).map(entry => entry.key)).toEqual([
      'queries.elections.candidatesByElection:{"election_id":"election-1"}',
      'queries.elections.electorsByElection:{"election_id":"election-1"}',
      'queries.votes.choicesByVote:{"vote_id":"vote-1"}',
    ]);
  });

  it('creates stable dependency identities and equality comparisons', () => {
    const first = discoverEventAgendaPreloadDependencies([{ id: 'agenda-1' }]);
    const same = { ...first, agendaItemIds: [...first.agendaItemIds] };
    const different = { ...first, agendaItemIds: ['agenda-2'] };
    expect(eventAgendaPreloadDependenciesKey(first)).toBe(
      eventAgendaPreloadDependenciesKey(same)
    );
    expect(areEventAgendaPreloadDependenciesEqual(first, same)).toBe(true);
    expect(areEventAgendaPreloadDependenciesEqual(first, different)).toBe(false);
  });

  it('creates the base event agenda preload keys used by event-route and participant-event preloads', () => {
    const keys = createEventAgendaBasePreloadEntries('event-1').map(entry => entry.key);

    expect(keys).toEqual([
      'queries.events.agendaWithElections:{"eventId":"event-1"}',
      'queries.events.agendaItemsFull:{"eventId":"event-1"}',
      'queries.agendas.byEvent:{"event_id":"event-1"}',
      'queries.events.withAgendaAndParticipants:{"id":"event-1"}',
    ]);
  });

  it('creates dependent agenda preload keys for detail, CR, forwarding, and resolved vote/election hooks', () => {
    const keys = createEventAgendaDependentPreloadEntries({
      agendaItemIds: ['agenda-1'],
      electionIds: ['election-1'],
      voteIds: ['vote-1'],
      userElectionParticipations: [{ election_id: 'election-1', elector_id: 'elector-1' }],
      userVoteParticipations: [{ vote_id: 'vote-1', voter_id: 'voter-1' }],
    }).map(entry => entry.key);

    expect(keys).toEqual([
      'queries.events.agendaItemDetail:{"id":"agenda-1"}',
      'queries.elections.byAgendaItem:{"agenda_item_id":"agenda-1"}',
      'queries.votes.byAgendaItem:{"agenda_item_id":"agenda-1"}',
      'queries.agendas.changeRequestTimeline:{"agenda_item_id":"agenda-1"}',
      'queries.amendments.agendaItemForwardingContext:{"agenda_item_id":"agenda-1"}',
      'queries.votes.byAgendaItems:{"agenda_item_ids":["agenda-1"]}',
      'queries.elections.candidatesByElection:{"election_id":"election-1"}',
      'queries.elections.electorsByElection:{"election_id":"election-1"}',
      'queries.votes.choicesByVote:{"vote_id":"vote-1"}',
      'queries.elections.userIndicativeParticipation:{"election_id":"election-1","elector_id":"elector-1"}',
      'queries.elections.userFinalParticipation:{"election_id":"election-1","elector_id":"elector-1"}',
      'queries.votes.userIndicativeParticipation:{"vote_id":"vote-1","voter_id":"voter-1"}',
      'queries.votes.userFinalParticipation:{"vote_id":"vote-1","voter_id":"voter-1"}',
    ]);
  });

  it('extracts unique participant event ids from active participation rows', () => {
    expect(
      extractCurrentUserParticipantEventIds([
        { event_id: 'event-2' },
        { event: { id: 'event-1' } },
        { event: { id: 'event-1' }, event_id: 'event-ignored' },
        { event: null },
      ])
    ).toEqual(['event-1', 'event-2']);
  });
});
