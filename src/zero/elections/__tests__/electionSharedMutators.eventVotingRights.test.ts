import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '../../rbac/errors';

const { canMock } = vi.hoisted(() => ({
  canMock: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: canMock,
}));

import { electionSharedMutators } from '../shared-mutators';

function allowActions(actions: string[]) {
  canMock.mockImplementation(async (_tx, _ctx, check) => {
    if (actions.includes(check.action)) return;
    throw new PermissionError(check.action, check.resource, check.eventId);
  });
}

function createTx(rows: unknown[]) {
  const remainingRows = [...rows];

  return {
    location: 'server',
    run: vi.fn(async () => {
      if (remainingRows.length === 0) {
        throw new Error('Unexpected query');
      }
      return remainingRows.shift();
    }),
    mutate: {
      election_candidate: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      elector: {
        insert: vi.fn(),
      },
      indicative_elector_participation: {
        insert: vi.fn(),
      },
      indicative_candidate_selection: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      final_elector_participation: {
        insert: vi.fn(),
      },
      final_candidate_selection: {
        insert: vi.fn(),
      },
    },
  };
}

const election = { id: 'election-1', agenda_item_id: 'agenda-1' };
const namedElection = { ...election, ballot_visibility: 'named' };
const secretElection = { ...election, ballot_visibility: 'secret' };
const agendaItem = { id: 'agenda-1', event_id: 'event-1' };
const candidate = { id: 'candidate-1', election_id: 'election-1', user_id: 'user-1' };
const secondCandidate = { id: 'candidate-2', election_id: 'election-1', user_id: 'user-2' };
const elector = { id: 'elector-1', election_id: 'election-1', user_id: 'user-1' };
const participation = {
  id: 'participation-1',
  election_id: 'election-1',
  elector_id: 'elector-1',
};

describe('electionSharedMutators event voting rights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a participant with passive voting rights to add themselves as a candidate', async () => {
    allowActions(['passive_voting']);
    const tx = createTx([election, agendaItem]);

    await electionSharedMutators.addCandidate.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'candidate-1',
        election_id: 'election-1',
        user_id: 'user-1',
        name: 'Ada',
        description: null,
        image_url: null,
        status: 'nominated',
        order_index: 1,
      },
    });

    expect(tx.mutate.election_candidate.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'candidate-1',
        election_id: 'election-1',
        user_id: 'user-1',
      })
    );
    expect(canMock).toHaveBeenCalledWith(
      tx,
      { userID: 'user-1' },
      expect.objectContaining({ action: 'passive_voting', resource: 'events', eventId: 'event-1' })
    );
  });

  it('rejects self-candidacy without passive voting rights or manager rights', async () => {
    allowActions([]);
    const tx = createTx([election, agendaItem, election, agendaItem]);

    await expect(
      electionSharedMutators.addCandidate.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          id: 'candidate-1',
          election_id: 'election-1',
          user_id: 'user-1',
          name: 'Ada',
          description: null,
          image_url: null,
          status: 'nominated',
          order_index: 1,
        },
      })
    ).rejects.toThrow(PermissionError);
  });

  it('allows a participant with passive voting rights to withdraw their own candidacy', async () => {
    allowActions(['passive_voting']);
    const tx = createTx([candidate, election, agendaItem]);

    await electionSharedMutators.deleteCandidate.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { id: 'candidate-1' },
    });

    expect(tx.mutate.election_candidate.delete).toHaveBeenCalledWith({ id: 'candidate-1' });
    expect(canMock).toHaveBeenCalledWith(
      tx,
      { userID: 'user-1' },
      expect.objectContaining({ action: 'passive_voting', resource: 'events', eventId: 'event-1' })
    );
  });

  it('rejects self-candidacy withdrawal without passive voting rights or manager rights', async () => {
    allowActions([]);
    const tx = createTx([candidate, election, agendaItem, election, agendaItem]);

    await expect(
      electionSharedMutators.deleteCandidate.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: { id: 'candidate-1' },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.election_candidate.delete).not.toHaveBeenCalled();
  });

  it('allows managers to remove another user candidate', async () => {
    allowActions(['manage']);
    const tx = createTx([{ ...candidate, user_id: 'user-2' }, election, agendaItem]);

    await electionSharedMutators.deleteCandidate.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { id: 'candidate-1' },
    });

    expect(tx.mutate.election_candidate.delete).toHaveBeenCalledWith({ id: 'candidate-1' });
    expect(canMock).toHaveBeenCalledWith(
      tx,
      { userID: 'user-1' },
      expect.objectContaining({ action: 'manage', resource: 'elections', eventId: 'event-1' })
    );
  });

  it('allows a participant with active voting rights to create their own elector record', async () => {
    allowActions(['active_voting']);
    const tx = createTx([election, agendaItem, null, null]);

    await electionSharedMutators.createElector.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'elector-1',
        election_id: 'election-1',
        user_id: 'user-1',
      },
    });

    expect(tx.mutate.elector.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'elector-1',
        election_id: 'election-1',
        user_id: 'user-1',
      })
    );
  });

  it('allows secret-ballot selections after the active voter participation exists', async () => {
    allowActions(['active_voting']);
    const tx = createTx([
      candidate,
      election,
      agendaItem,
      elector,
      elector,
      election,
      agendaItem,
      participation,
    ]);

    await electionSharedMutators.createIndicativeCandidateSelection.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'selection-1',
        election_id: 'election-1',
        candidate_id: 'candidate-1',
        elector_participation_id: null,
      },
    });

    expect(tx.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'selection-1',
        election_id: 'election-1',
        candidate_id: 'candidate-1',
        elector_participation_id: null,
      })
    );
  });

  it('rejects secret-ballot selections without active voting rights or manager rights', async () => {
    allowActions([]);
    const tx = createTx([
      candidate,
      election,
      agendaItem,
      elector,
      elector,
      election,
      agendaItem,
      election,
      agendaItem,
    ]);

    await expect(
      electionSharedMutators.createIndicativeCandidateSelection.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          id: 'selection-1',
          election_id: 'election-1',
          candidate_id: 'candidate-1',
          elector_participation_id: null,
        },
      })
    ).rejects.toThrow(PermissionError);
  });

  it('creates named indicative election participation and selections on first submission', async () => {
    allowActions(['active_voting']);
    const tx = createTx([elector, election, agendaItem, namedElection, candidate, null]);

    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        participation: {
          id: 'participation-1',
          election_id: 'election-1',
          elector_id: 'elector-1',
        },
        selections: [
          {
            id: 'selection-1',
            election_id: 'election-1',
            candidate_id: 'candidate-1',
            elector_participation_id: 'participation-1',
          },
        ],
      },
    });

    expect(tx.mutate.indicative_elector_participation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participation-1',
        election_id: 'election-1',
        elector_id: 'elector-1',
      })
    );
    expect(tx.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'selection-1',
        election_id: 'election-1',
        candidate_id: 'candidate-1',
        elector_participation_id: 'participation-1',
      })
    );
  });

  it('creates a missing elector inside the indicative election vote transaction', async () => {
    allowActions(['active_voting']);
    const tx = createTx([
      election,
      agendaItem,
      null,
      null,
      elector,
      election,
      agendaItem,
      namedElection,
      candidate,
      null,
    ]);

    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        elector,
        participation: {
          id: 'participation-1',
          election_id: 'election-1',
          elector_id: 'elector-1',
        },
        selections: [
          {
            id: 'selection-1',
            election_id: 'election-1',
            candidate_id: 'candidate-1',
            elector_participation_id: 'participation-1',
          },
        ],
      },
    });

    expect(tx.mutate.elector.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'elector-1',
        election_id: 'election-1',
        user_id: 'user-1',
      })
    );
    expect(tx.mutate.indicative_elector_participation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participation-1',
        elector_id: 'elector-1',
      })
    );
    expect(tx.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'selection-1',
        elector_participation_id: 'participation-1',
      })
    );
  });

  it('replaces linked named indicative election selections on repeat submission', async () => {
    allowActions(['active_voting']);
    const tx = createTx([
      elector,
      election,
      agendaItem,
      namedElection,
      candidate,
      secondCandidate,
      participation,
      [{ id: 'old-selection-1' }, { id: 'old-selection-2' }],
    ]);

    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        participation: {
          id: 'new-participation-id',
          election_id: 'election-1',
          elector_id: 'elector-1',
        },
        selections: [
          {
            id: 'selection-2',
            election_id: 'election-1',
            candidate_id: 'candidate-1',
            elector_participation_id: 'new-participation-id',
          },
          {
            id: 'selection-3',
            election_id: 'election-1',
            candidate_id: 'candidate-2',
            elector_participation_id: 'new-participation-id',
          },
        ],
      },
    });

    expect(tx.mutate.indicative_elector_participation.insert).not.toHaveBeenCalled();
    expect(tx.mutate.indicative_candidate_selection.delete).toHaveBeenCalledTimes(2);
    expect(tx.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'selection-2',
        elector_participation_id: 'participation-1',
      })
    );
    expect(tx.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'selection-3',
        elector_participation_id: 'participation-1',
      })
    );
  });

  it('keeps secret indicative election votes one-time only', async () => {
    allowActions(['active_voting']);
    const tx = createTx([elector, election, agendaItem, secretElection, candidate, participation]);

    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          participation: {
            id: 'new-participation-id',
            election_id: 'election-1',
            elector_id: 'elector-1',
          },
          selections: [
            {
              id: 'selection-2',
              election_id: 'election-1',
              candidate_id: 'candidate-1',
              elector_participation_id: null,
            },
          ],
        },
      })
    ).rejects.toThrow(/already voted/i);

    expect(tx.mutate.indicative_candidate_selection.delete).not.toHaveBeenCalled();
    expect(tx.mutate.indicative_candidate_selection.insert).not.toHaveBeenCalled();
  });

  it('leaves final election votes insert-only so duplicate submissions are rejected by persistence', async () => {
    allowActions(['active_voting']);
    const tx = createTx([elector, election, agendaItem]);
    tx.mutate.final_elector_participation.insert.mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "final_elector_participation_election_id_elector_id_key"'
      )
    );

    await expect(
      electionSharedMutators.castFinalElectionVote.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          id: 'final-participation-2',
          election_id: 'election-1',
          elector_id: 'elector-1',
        },
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('creates a missing elector inside the final full election vote transaction', async () => {
    allowActions(['active_voting']);
    const tx = createTx([
      election,
      agendaItem,
      null,
      null,
      elector,
      election,
      agendaItem,
      namedElection,
      candidate,
    ]);

    await electionSharedMutators.castFinalElectionVoteFull.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        elector,
        participation: {
          id: 'final-participation-1',
          election_id: 'election-1',
          elector_id: 'elector-1',
        },
        selections: [
          {
            id: 'final-selection-1',
            election_id: 'election-1',
            candidate_id: 'candidate-1',
            elector_participation_id: 'final-participation-1',
          },
        ],
      },
    });

    expect(tx.mutate.elector.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'elector-1',
        election_id: 'election-1',
        user_id: 'user-1',
      })
    );
    expect(tx.mutate.final_elector_participation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'final-participation-1',
        elector_id: 'elector-1',
      })
    );
    expect(tx.mutate.final_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'final-selection-1',
        elector_participation_id: 'final-participation-1',
      })
    );
  });
});
