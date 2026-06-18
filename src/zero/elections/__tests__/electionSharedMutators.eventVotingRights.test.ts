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
      },
      elector: {
        insert: vi.fn(),
      },
      indicative_candidate_selection: {
        insert: vi.fn(),
      },
    },
  };
}

const election = { id: 'election-1', agenda_item_id: 'agenda-1' };
const agendaItem = { id: 'agenda-1', event_id: 'event-1' };
const candidate = { id: 'candidate-1', election_id: 'election-1' };
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

  it('allows a participant with active voting rights to create their own elector record', async () => {
    allowActions(['active_voting']);
    const tx = createTx([election, agendaItem]);

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
});
