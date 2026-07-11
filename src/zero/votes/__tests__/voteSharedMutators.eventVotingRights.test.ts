import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '../../rbac/errors';

const { canMock } = vi.hoisted(() => ({
  canMock: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: canMock,
}));

import { voteSharedMutators } from '../shared-mutators';

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
      voter: {
        insert: vi.fn(),
      },
      indicative_voter_participation: {
        insert: vi.fn(),
      },
      indicative_choice_decision: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      final_voter_participation: {
        insert: vi.fn(),
      },
      final_choice_decision: {
        insert: vi.fn(),
      },
    },
  };
}

const vote = {
  id: 'vote-1',
  agenda_item_id: 'agenda-1',
  amendment_id: null,
  electorate_snapshotted_at: 1,
};
const indicativeVote = { ...vote, status: 'indicative' };
const finalOpenVote = { ...vote, status: 'final' };
const closedVote = { ...vote, status: 'closed' };
const namedVote = { ...vote, status: 'indicative', ballot_visibility: 'named' };
const secretVote = { ...vote, status: 'indicative', ballot_visibility: 'secret' };
const agendaItem = { id: 'agenda-1', event_id: 'event-1', amendment_id: null };
const choice = { id: 'choice-1', vote_id: 'vote-1' };
const voter = { id: 'voter-1', vote_id: 'vote-1', user_id: 'user-1' };
const participation = {
  id: 'participation-1',
  vote_id: 'vote-1',
  voter_id: 'voter-1',
};

describe('voteSharedMutators event voting rights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents direct voter creation because snapshots are server-managed', async () => {
    allowActions(['manage_votes']);
    const tx = createTx([]);

    await expect(
      voteSharedMutators.createVoter.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          id: 'voter-1',
          vote_id: 'vote-1',
          user_id: 'user-1',
        },
      })
    ).rejects.toThrow(/server-side electorate snapshot/i);

    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
  });

  it('allows secret-ballot choice decisions after the active voter participation exists', async () => {
    allowActions(['active_voting']);
    const tx = createTx([
      choice,
      indicativeVote,
      vote,
      agendaItem,
      voter,
      voter,
      vote,
      agendaItem,
      participation,
    ]);

    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: null,
      },
    });

    expect(tx.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: null,
      })
    );
  });

  it('keeps a snapshotted secret-ballot voter eligible after rights change', async () => {
    allowActions([]);
    const tx = createTx([
      choice,
      indicativeVote,
      vote,
      agendaItem,
      voter,
      voter,
      vote,
      agendaItem,
      vote,
      agendaItem,
    ]);

    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: null,
      },
    });
    expect(tx.mutate.indicative_choice_decision.insert).toHaveBeenCalled();
  });

  it('creates named indicative participation and decision on first submission', async () => {
    allowActions(['active_voting']);
    const tx = createTx([voter, vote, agendaItem, namedVote, choice, null]);

    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        participation: {
          id: 'participation-1',
          vote_id: 'vote-1',
          voter_id: 'voter-1',
        },
        decisions: [
          {
            id: 'decision-1',
            vote_id: 'vote-1',
            choice_id: 'choice-1',
            voter_participation_id: 'participation-1',
          },
        ],
      },
    });

    expect(tx.mutate.indicative_voter_participation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participation-1',
        vote_id: 'vote-1',
        voter_id: 'voter-1',
      })
    );
    expect(tx.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'participation-1',
      })
    );
  });

  it('rejects missing voters instead of extending the frozen indicative electorate', async () => {
    allowActions(['active_voting']);
    const tx = createTx([vote, agendaItem, null, null, vote, agendaItem]);

    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          voter,
          participation: { id: 'participation-1', vote_id: 'vote-1', voter_id: 'voter-1' },
          decisions: [
            {
              id: 'decision-1',
              vote_id: 'vote-1',
              choice_id: 'choice-1',
              voter_participation_id: 'participation-1',
            },
          ],
        },
      })
    ).rejects.toThrow(/frozen electorate snapshot/i);
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
  });

  it('replaces linked named indicative decisions on repeat submission', async () => {
    allowActions(['active_voting']);
    const tx = createTx([
      voter,
      vote,
      agendaItem,
      namedVote,
      choice,
      participation,
      [{ id: 'old-decision-1' }],
    ]);

    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        participation: {
          id: 'new-participation-id',
          vote_id: 'vote-1',
          voter_id: 'voter-1',
        },
        decisions: [
          {
            id: 'decision-2',
            vote_id: 'vote-1',
            choice_id: 'choice-1',
            voter_participation_id: 'new-participation-id',
          },
        ],
      },
    });

    expect(tx.mutate.indicative_voter_participation.insert).not.toHaveBeenCalled();
    expect(tx.mutate.indicative_choice_decision.delete).toHaveBeenCalledWith({
      id: 'old-decision-1',
    });
    expect(tx.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'decision-2',
        voter_participation_id: 'participation-1',
      })
    );
  });

  it('keeps secret indicative votes one-time only', async () => {
    allowActions(['active_voting']);
    const tx = createTx([voter, vote, agendaItem, secretVote, choice, participation]);

    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          participation: {
            id: 'new-participation-id',
            vote_id: 'vote-1',
            voter_id: 'voter-1',
          },
          decisions: [
            {
              id: 'decision-2',
              vote_id: 'vote-1',
              choice_id: 'choice-1',
              voter_participation_id: null,
            },
          ],
        },
      })
    ).rejects.toThrow(/already voted/i);

    expect(tx.mutate.indicative_choice_decision.delete).not.toHaveBeenCalled();
    expect(tx.mutate.indicative_choice_decision.insert).not.toHaveBeenCalled();
  });

  it('rejects indicative replacement submissions outside the indicative phase', async () => {
    allowActions(['active_voting']);

    for (const blockedVote of [finalOpenVote, closedVote]) {
      const tx = createTx([
        voter,
        vote,
        agendaItem,
        { ...blockedVote, ballot_visibility: 'named' },
      ]);

      await expect(
        voteSharedMutators.replaceIndicativeVote.fn({
          tx: tx as never,
          ctx: { userID: 'user-1' } as never,
          args: {
            participation,
            decisions: [
              {
                id: 'decision-1',
                vote_id: 'vote-1',
                choice_id: 'choice-1',
                voter_participation_id: 'participation-1',
              },
            ],
          },
        })
      ).rejects.toThrow(/indicative vote is open/i);

      expect(tx.mutate.indicative_voter_participation.insert).not.toHaveBeenCalled();
      expect(tx.mutate.indicative_choice_decision.insert).not.toHaveBeenCalled();
    }
  });

  it('rejects indicative decision creation outside the indicative phase', async () => {
    allowActions(['active_voting']);

    for (const blockedVote of [finalOpenVote, closedVote]) {
      const tx = createTx([choice, blockedVote]);

      await expect(
        voteSharedMutators.createIndicativeChoiceDecision.fn({
          tx: tx as never,
          ctx: { userID: 'user-1' } as never,
          args: {
            id: 'decision-1',
            vote_id: 'vote-1',
            choice_id: 'choice-1',
            voter_participation_id: null,
          },
        })
      ).rejects.toThrow(/indicative vote is open/i);

      expect(tx.mutate.indicative_choice_decision.insert).not.toHaveBeenCalled();
    }
  });

  it('rejects final participation submissions outside the final phase', async () => {
    allowActions(['active_voting']);

    for (const blockedVote of [indicativeVote, closedVote]) {
      const tx = createTx([voter, vote, agendaItem, blockedVote]);

      await expect(
        voteSharedMutators.castFinalVote.fn({
          tx: tx as never,
          ctx: { userID: 'user-1' } as never,
          args: {
            id: 'final-participation-1',
            vote_id: 'vote-1',
            voter_id: 'voter-1',
          },
        })
      ).rejects.toThrow(/final vote is open/i);

      expect(tx.mutate.final_voter_participation.insert).not.toHaveBeenCalled();
    }
  });

  it('rejects final decision creation outside the final phase', async () => {
    allowActions(['active_voting']);

    for (const blockedVote of [indicativeVote, closedVote]) {
      const tx = createTx([choice, blockedVote]);

      await expect(
        voteSharedMutators.createFinalChoiceDecision.fn({
          tx: tx as never,
          ctx: { userID: 'user-1' } as never,
          args: {
            id: 'decision-1',
            vote_id: 'vote-1',
            choice_id: 'choice-1',
            voter_participation_id: null,
          },
        })
      ).rejects.toThrow(/final vote is open/i);

      expect(tx.mutate.final_choice_decision.insert).not.toHaveBeenCalled();
    }
  });

  it('leaves final votes insert-only so duplicate submissions are rejected by persistence', async () => {
    allowActions(['active_voting']);
    const tx = createTx([voter, vote, agendaItem, finalOpenVote]);
    tx.mutate.final_voter_participation.insert.mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "final_voter_participation_vote_id_voter_id_key"'
      )
    );

    await expect(
      voteSharedMutators.castFinalVote.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          id: 'final-participation-2',
          vote_id: 'vote-1',
          voter_id: 'voter-1',
        },
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('rejects missing voters instead of extending the frozen final electorate', async () => {
    allowActions(['active_voting']);
    const tx = createTx([vote, agendaItem, null, null, vote, agendaItem]);

    await expect(
      voteSharedMutators.castFinalVoteFull.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          voter,
          participation: {
            id: 'final-participation-1',
            vote_id: 'vote-1',
            voter_id: 'voter-1',
          },
          decisions: [
            {
              id: 'final-decision-1',
              vote_id: 'vote-1',
              choice_id: 'choice-1',
              voter_participation_id: 'final-participation-1',
            },
          ],
        },
      })
    ).rejects.toThrow(/frozen electorate snapshot/i);
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
  });
});
