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
      indicative_choice_decision: {
        insert: vi.fn(),
      },
    },
  };
}

const vote = { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: null };
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

  it('allows a participant with active voting rights to create their own voter record', async () => {
    allowActions(['active_voting']);
    const tx = createTx([vote, agendaItem]);

    await voteSharedMutators.createVoter.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'voter-1',
        vote_id: 'vote-1',
        user_id: 'user-1',
      },
    });

    expect(tx.mutate.voter.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'voter-1',
        vote_id: 'vote-1',
        user_id: 'user-1',
      })
    );
    expect(canMock).toHaveBeenCalledWith(
      tx,
      { userID: 'user-1' },
      expect.objectContaining({ action: 'active_voting', resource: 'events', eventId: 'event-1' })
    );
  });

  it('allows secret-ballot choice decisions after the active voter participation exists', async () => {
    allowActions(['active_voting']);
    const tx = createTx([choice, vote, agendaItem, voter, voter, vote, agendaItem, participation]);

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

  it('rejects secret-ballot choice decisions without active voting rights or manager rights', async () => {
    allowActions([]);
    const tx = createTx([
      choice,
      vote,
      agendaItem,
      voter,
      voter,
      vote,
      agendaItem,
      vote,
      agendaItem,
    ]);

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
    ).rejects.toThrow(PermissionError);
  });
});
