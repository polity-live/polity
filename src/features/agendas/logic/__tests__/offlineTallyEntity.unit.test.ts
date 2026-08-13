import { describe, expect, it } from 'vitest';

import { buildOfflineTallyEntity } from '../offlineTallyEntity';

describe('buildOfflineTallyEntity', () => {
  it('builds a vote tally entity for an active sequence vote', () => {
    const entity = buildOfflineTallyEntity({
      phase: 'final',
      agendaTitle: 'Agenda item',
      election: null,
      vote: {
        id: 'variant-vote-1',
        title: 'Variant final vote',
        choices: [
          { id: 'choice-1', label: 'Variant A' },
          { id: 'choice-2', label: 'Variant B' },
        ],
        offline_tallies: [
          { phase: 'indicative', choice_id: 'choice-1', count: 2 },
          { phase: 'final', choice_id: 'choice-2', count: 3 },
        ],
      },
      participantCount: 7,
    });

    expect(entity).toEqual({
      kind: 'vote',
      itemId: 'variant-vote-1',
      title: 'Variant final vote',
      choices: [
        { id: 'choice-1', label: 'Variant A' },
        { id: 'choice-2', label: 'Variant B' },
      ],
      tallies: [{ id: 'choice-2', count: 3 }],
      participantCount: 7,
      votesPerParticipant: 1,
      maxPerEntryVotes: null,
      maxTotalVotes: 7,
    });
  });

  it('returns null for sequence placeholders without a backing vote', () => {
    expect(
      buildOfflineTallyEntity({
        phase: 'indicative',
        agendaTitle: 'Agenda item',
        election: null,
        vote: null,
        participantCount: 7,
      })
    ).toBeNull();
  });

  it('builds an election tally entity with non-withdrawn candidates', () => {
    const entity = buildOfflineTallyEntity({
      phase: 'indicative',
      agendaTitle: 'Agenda item',
      election: {
        id: 'election-1',
        title: null,
        max_votes: 2,
        candidates: [
          { id: 'candidate-1', name: 'Alice', status: 'accepted' },
          { id: 'candidate-2', name: 'Bob', status: 'withdrawn' },
        ],
        offline_tallies: [{ phase: 'indicative', candidate_id: 'candidate-1', count: 4 }],
      },
      participantCount: 5,
    });

    expect(entity).toMatchObject({
      kind: 'election',
      itemId: 'election-1',
      title: 'Agenda item',
      choices: [{ id: 'candidate-1', label: 'Alice' }],
      tallies: [{ id: 'candidate-1', count: 4 }],
      participantCount: 5,
      votesPerParticipant: 2,
      maxPerEntryVotes: 5,
      maxTotalVotes: 10,
    });
  });
});
