import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '../../rbac/errors';

const canMock = vi.hoisted(() => vi.fn());
vi.mock('../../rbac/can', () => ({ can: (...args: unknown[]) => canMock(...args) }));

import { voteSharedMutators } from '../shared-mutators';

function createTx(results: unknown[] = [], location: 'client' | 'server' = 'client') {
  const queue = [...results];
  const ops = () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() });
  return {
    clientID: 'client-1', mutationID: 1, reason: 'test', location,
    run: vi.fn(async () => queue.shift()),
    mutate: {
      vote: ops(), vote_choice: ops(), voter: ops(),
      indicative_voter_participation: ops(), indicative_choice_decision: ops(),
      final_voter_participation: ops(), final_choice_decision: ops(), vote_offline_tally: ops(),
    },
  };
}

const ctx = { userID: 'user-1', email: 'user-1@example.com' };
const voter = { id: 'voter-1', vote_id: 'vote-1', user_id: 'user-1' };
const participation = { id: 'participation-1', vote_id: 'vote-1', voter_id: 'voter-1' };
const decision = {
  id: 'decision-1', vote_id: 'vote-1', choice_id: 'choice-1',
  voter_participation_id: 'participation-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  canMock.mockResolvedValue(undefined);
});

describe('vote shared mutator branch contracts', () => {
  it('runs the optimistic CRUD and legacy facades on the client', async () => {
    const tx = createTx();
    await voteSharedMutators.startVote.fn({ tx: tx as never, ctx, args: {} as never });
    await voteSharedMutators.submitVote.fn({ tx: tx as never, ctx, args: {} as never });
    await voteSharedMutators.createVote.fn({
      tx: tx as never, ctx,
      args: {
        id: 'vote-1', agenda_item_id: null, amendment_id: null, title: 'Vote',
        description: null, purpose: 'closing', status: null, majority_type: null,
        closing_type: null, closing_duration_seconds: null, closing_end_time: null,
        visibility: null, ballot_visibility: null,
      } as never,
    });
    await voteSharedMutators.updateVote.fn({
      tx: tx as never, ctx, args: { id: 'vote-1', title: 'Updated' } as never,
    });
    await voteSharedMutators.updateVote.fn({
      tx: tx as never, ctx, args: { id: 'vote-1', status: 'final' } as never,
    });
    await voteSharedMutators.deleteVote.fn({ tx: tx as never, ctx, args: { id: 'vote-1' } });
    await voteSharedMutators.closeExpiredFinalVotesForEvent.fn({
      tx: tx as never, ctx, args: { event_id: 'event-1' },
    });
    await voteSharedMutators.createVoteChoice.fn({
      tx: tx as never, ctx,
      args: { id: 'choice-1', vote_id: 'vote-1', label: 'Yes', order_index: 0 } as never,
    });
    await voteSharedMutators.updateVoteChoice.fn({
      tx: tx as never, ctx, args: { id: 'choice-1', label: 'No' } as never,
    });
    await voteSharedMutators.deleteVoteChoice.fn({
      tx: tx as never, ctx, args: { id: 'choice-1' },
    });
    await voteSharedMutators.createVoter.fn({ tx: tx as never, ctx, args: voter });
    await voteSharedMutators.deleteVoter.fn({ tx: tx as never, ctx, args: { id: 'voter-1' } });
    await voteSharedMutators.castIndicativeVote.fn({
      tx: tx as never, ctx, args: participation,
    });
    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: tx as never, ctx, args: decision,
    });
    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: tx as never, ctx, args: { ...decision, voter_participation_id: null },
    });
    await voteSharedMutators.castFinalVote.fn({ tx: tx as never, ctx, args: participation });
    await voteSharedMutators.createFinalChoiceDecision.fn({
      tx: tx as never, ctx, args: decision,
    });
    await voteSharedMutators.createFinalChoiceDecision.fn({
      tx: tx as never, ctx, args: { ...decision, voter_participation_id: null },
    });
    await voteSharedMutators.deleteOfflineTally.fn({
      tx: tx as never, ctx, args: { id: 'tally-1' },
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalled();
    expect(tx.mutate.vote.update).toHaveBeenCalledTimes(2);
    expect(tx.mutate.vote.delete).toHaveBeenCalled();
    expect(tx.mutate.vote_choice.update).toHaveBeenCalled();
    expect(tx.mutate.indicative_voter_participation.insert).toHaveBeenCalled();
    expect(tx.mutate.final_voter_participation.insert).toHaveBeenCalled();
  });

  it('rejects missing votes and resolves manager scope through event and amendment parents', async () => {
    await expect(
      voteSharedMutators.updateVote.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' } as never,
      })
    ).rejects.toThrow('Vote not found');

    const event = createTx([
      { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: null },
      { id: 'agenda-1', event_id: 'event-1', amendment_id: null },
    ], 'server');
    await voteSharedMutators.deleteVote.fn({ tx: event as never, ctx, args: { id: 'vote-1' } });
    expect(canMock).toHaveBeenCalledWith(
      event, ctx, { action: 'manage_votes', resource: 'events', eventId: 'event-1' }
    );

    const amendment = createTx([
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
    ], 'server');
    await voteSharedMutators.deleteVote.fn({
      tx: amendment as never, ctx, args: { id: 'vote-1' },
    });
    expect(canMock).toHaveBeenCalledWith(
      amendment, ctx, { action: 'manage', resource: 'amendments', amendmentId: 'amendment-1' }
    );

    const fallback = createTx([{ id: 'agenda-1', event_id: 'event-1', amendment_id: 'amendment-1' }], 'server');
    canMock
      .mockRejectedValueOnce(new PermissionError('manage_votes', 'events', 'event-1'))
      .mockResolvedValueOnce(undefined);
    await voteSharedMutators.createVote.fn({
      tx: fallback as never, ctx,
      args: { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: null } as never,
    });
    expect(canMock).toHaveBeenLastCalledWith(
      fallback, ctx, { action: 'manage', resource: 'amendments', amendmentId: 'amendment-1' }
    );

    canMock.mockRejectedValueOnce(new Error('rbac unavailable'));
    await expect(
      voteSharedMutators.createVote.fn({
        tx: createTx([{ id: 'agenda-1', event_id: 'event-1' }], 'server') as never,
        ctx,
        args: { id: 'vote-2', agenda_item_id: 'agenda-1', amendment_id: null } as never,
      })
    ).rejects.toThrow('rbac unavailable');

    await expect(
      voteSharedMutators.createVote.fn({
        tx: createTx([], 'server') as never, ctx,
        args: { id: 'vote-3', agenda_item_id: null, amendment_id: null } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    await expect(
      voteSharedMutators.deleteVote.fn({
        tx: createTx([
          { id: 'vote-missing-agenda', agenda_item_id: 'missing', amendment_id: null },
          null,
        ], 'server') as never,
        ctx,
        args: { id: 'vote-missing-agenda' },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    canMock.mockRejectedValueOnce(new PermissionError('manage_votes', 'events', 'event-1'));
    await expect(
      voteSharedMutators.createVote.fn({
        tx: createTx([{ id: 'agenda-1', event_id: 'event-1', amendment_id: null }], 'server') as never,
        ctx,
        args: { id: 'vote-4', agenda_item_id: 'agenda-1', amendment_id: null } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('validates server-side choices, voter records, and frozen electorate state', async () => {
    await expect(
      voteSharedMutators.updateVoteChoice.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' } as never,
      })
    ).rejects.toThrow('Vote choice not found');
    const updateChoice = createTx([
      { id: 'choice-1', vote_id: 'vote-1' },
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
    ], 'server');
    await voteSharedMutators.updateVoteChoice.fn({
      tx: updateChoice as never, ctx, args: { id: 'choice-1', label: 'Updated' } as never,
    });
    const deleteChoice = createTx([
      { id: 'choice-1', vote_id: 'vote-1' },
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
    ], 'server');
    await voteSharedMutators.deleteVoteChoice.fn({
      tx: deleteChoice as never, ctx, args: { id: 'choice-1' },
    });
    await expect(
      voteSharedMutators.deleteVoteChoice.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' },
      })
    ).rejects.toThrow('Vote choice not found');
    await expect(
      voteSharedMutators.castIndicativeVote.fn({
        tx: createTx([], 'server') as never, ctx,
        args: { ...participation, voter_id: null } as never,
      })
    ).rejects.toThrow('Voter is required');
    await expect(
      voteSharedMutators.castIndicativeVote.fn({
        tx: createTx([null], 'server') as never, ctx, args: participation,
      })
    ).rejects.toThrow('Voter not found');
    await expect(
      voteSharedMutators.castIndicativeVote.fn({
        tx: createTx([
          { ...voter, vote_id: 'other' },
        ], 'server') as never,
        ctx,
        args: participation,
      })
    ).rejects.toThrow('Voter not found');
    await expect(
      voteSharedMutators.castIndicativeVote.fn({
        tx: createTx([
          voter,
          { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
          { id: 'agenda-1', event_id: 'event-1' },
        ], 'server') as never,
        ctx,
        args: participation,
      })
    ).rejects.toThrow('not been snapshotted');
    await expect(
      voteSharedMutators.createIndicativeChoiceDecision.fn({
        tx: createTx([null], 'server') as never,
        ctx,
        args: decision,
      })
    ).rejects.toThrow('choice not found');
    await expect(
      voteSharedMutators.createIndicativeChoiceDecision.fn({
        tx: createTx([{ id: 'choice-1', vote_id: 'other' }], 'server') as never,
        ctx,
        args: decision,
      })
    ).rejects.toThrow('choice not found');
    await expect(
      voteSharedMutators.deleteVoter.fn({
        tx: createTx([], 'server') as never, ctx, args: { id: 'voter-1' },
      })
    ).rejects.toThrow('server-side electorate snapshot');
  });

  it('validates linked indicative and final participation ownership on the server', async () => {
    const choice = { id: 'choice-1', vote_id: 'vote-1' };
    const openIndicative = { id: 'vote-1', status: 'indicative' };
    const openFinal = { id: 'vote-1', status: 'final' };

    await expect(
      voteSharedMutators.createIndicativeChoiceDecision.fn({
        tx: createTx([choice, openIndicative, null], 'server') as never,
        ctx,
        args: decision,
      })
    ).rejects.toThrow('participation not found');
    await expect(
      voteSharedMutators.createIndicativeChoiceDecision.fn({
        tx: createTx([
          choice, openIndicative,
          { ...participation, user_id: 'user-2' },
        ], 'server') as never,
        ctx,
        args: decision,
      })
    ).rejects.toThrow('does not own');
    const indicative = createTx([
      choice, openIndicative, { ...participation, user_id: ctx.userID },
    ], 'server');
    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: indicative as never, ctx, args: decision,
    });
    expect(indicative.mutate.indicative_choice_decision.insert).toHaveBeenCalled();

    await expect(
      voteSharedMutators.createFinalChoiceDecision.fn({
        tx: createTx([choice, openFinal, null], 'server') as never,
        ctx,
        args: decision,
      })
    ).rejects.toThrow('participation not found');
    await expect(
      voteSharedMutators.createFinalChoiceDecision.fn({
        tx: createTx([
          choice, openFinal, { ...participation, voter_id: null },
        ], 'server') as never,
        ctx,
        args: decision,
      })
    ).rejects.toThrow('Voter is missing');
    const final = createTx([
      choice,
      openFinal,
      participation,
      voter,
      { id: 'vote-1', agenda_item_id: null, amendment_id: null, electorate_snapshotted_at: 1 },
    ], 'server');
    await voteSharedMutators.createFinalChoiceDecision.fn({
      tx: final as never, ctx, args: decision,
    });
    expect(final.mutate.final_choice_decision.insert).toHaveBeenCalled();
  });

  it('falls back through active-voter and manager permission outcomes', async () => {
    const noParent = createTx([
      { id: 'vote-1', agenda_item_id: null, amendment_id: undefined },
      { id: 'vote-1', agenda_item_id: null, amendment_id: undefined },
    ], 'server');
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: noParent as never, ctx, args: { voter, participation, decisions: [] },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const unexpected = createTx([
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    canMock.mockRejectedValueOnce(new Error('active rights unavailable'));
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: unexpected as never, ctx, args: { voter, participation, decisions: [] },
      })
    ).rejects.toThrow('active rights unavailable');

    const managedOther = createTx([
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
      { id: 'voter-2', vote_id: 'other', user_id: 'user-2' },
    ], 'server');
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: managedOther as never,
        ctx,
        args: {
          voter: { id: 'voter-2', vote_id: 'vote-1', user_id: 'user-2' },
          participation: { id: 'p-2', vote_id: 'vote-1', voter_id: 'voter-2' },
          decisions: [],
        },
      })
    ).rejects.toThrow('already used');
  });

  it('reuses matching voter ids and per-user electorate rows', async () => {
    const matching = createTx([
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      voter,
      voter,
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'vote-1', status: 'indicative', ballot_visibility: 'named' },
      null,
    ], 'server');
    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: matching as never, ctx, args: { voter, participation, decisions: [] },
    });
    expect(matching.mutate.voter.insert).not.toHaveBeenCalled();

    const byUser = createTx([
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'voter-existing', vote_id: 'vote-1', user_id: 'user-1' },
      { id: 'voter-existing', vote_id: 'vote-1', user_id: 'user-1' },
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'vote-1', status: 'indicative', ballot_visibility: 'named' },
      null,
    ], 'server');
    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: byUser as never, ctx, args: { voter, participation, decisions: [] },
    });
    expect(byUser.mutate.voter.insert).not.toHaveBeenCalled();

    const localElection = { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' };
    const inserted = createTx([
      localElection,
      localElection,
      null,
      null,
      localElection,
      voter,
      { ...localElection, electorate_snapshotted_at: null },
      { id: 'vote-1', status: 'indicative', ballot_visibility: 'named' },
      null,
    ], 'server');
    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: inserted as never, ctx, args: { voter, participation, decisions: [] },
    });
    expect(inserted.mutate.voter.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'voter-1' })
    );
  });

  it('allows manager fallback for unlinked secret decisions and validates missing participation', async () => {
    const choice = { id: 'choice-1', vote_id: 'vote-1' };
    const managerFallback = createTx([
      choice,
      { id: 'vote-1', status: 'final' },
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: null },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    await voteSharedMutators.createFinalChoiceDecision.fn({
      tx: managerFallback as never,
      ctx,
      args: { ...decision, voter_participation_id: null },
    });
    expect(managerFallback.mutate.final_choice_decision.insert).toHaveBeenCalled();

    const missingParticipation = createTx([
      choice,
      { id: 'vote-1', status: 'indicative' },
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: missingParticipation as never,
      ctx,
      args: { ...decision, voter_participation_id: null },
    });
    expect(missingParticipation.mutate.indicative_choice_decision.insert).toHaveBeenCalled();

    const noEvent = createTx([
      choice,
      { id: 'vote-1', status: 'indicative' },
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
    ], 'server');
    await voteSharedMutators.createIndicativeChoiceDecision.fn({
      tx: noEvent as never,
      ctx,
      args: { ...decision, voter_participation_id: null },
    });
    expect(noEvent.mutate.indicative_choice_decision.insert).toHaveBeenCalled();

    const validFinalOwner = createTx([
      choice,
      { id: 'vote-1', status: 'final' },
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      voter,
      voter,
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      participation,
    ], 'server');
    await voteSharedMutators.createFinalChoiceDecision.fn({
      tx: validFinalOwner as never,
      ctx,
      args: { ...decision, voter_participation_id: null },
    });
    expect(validFinalOwner.mutate.final_choice_decision.insert).toHaveBeenCalled();

    const missingFinalParticipation = createTx([
      choice,
      { id: 'vote-1', status: 'final' },
      { id: 'vote-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      voter,
      voter,
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
    ], 'server');
    await voteSharedMutators.createFinalChoiceDecision.fn({
      tx: missingFinalParticipation as never,
      ctx,
      args: { ...decision, voter_participation_id: null },
    });
    expect(missingFinalParticipation.mutate.final_choice_decision.insert).toHaveBeenCalled();
  });

  it('covers client indicative replacement validation and named/secret persistence', async () => {
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: createTx() as never, ctx,
        args: { participation: { ...participation, voter_id: null }, decisions: [] } as never,
      })
    ).rejects.toThrow('Voter is required');
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: createTx() as never, ctx,
        args: { voter: { ...voter, id: 'other' }, participation, decisions: [] },
      })
    ).rejects.toThrow('does not match');

    const named = createTx([{ id: 'vote-1', status: 'indicative', ballot_visibility: 'named' }, null]);
    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: named as never, ctx, args: { voter, participation, decisions: [decision] },
    });
    expect(named.mutate.voter.insert).toHaveBeenCalled();
    expect(named.mutate.indicative_voter_participation.insert).toHaveBeenCalled();
    expect(named.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: 'participation-1' })
    );

    const secret = createTx([
      { id: 'vote-1', status: 'indicative', ballot_visibility: 'secret' }, null,
    ]);
    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: secret as never, ctx,
      args: { participation, decisions: [{ ...decision, voter_participation_id: null }] },
    });
    expect(secret.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: null })
    );

    const wrongDecision = createTx([{ id: 'vote-1', status: 'indicative' }]);
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: wrongDecision as never, ctx,
        args: { participation, decisions: [{ ...decision, vote_id: 'other' }] },
      })
    ).rejects.toThrow('does not belong');

    const unlinked = createTx([{ id: 'vote-1', status: 'indicative', ballot_visibility: 'named' }, null]);
    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: unlinked as never, ctx,
        args: { participation, decisions: [{ ...decision, voter_participation_id: null }] },
      })
    ).rejects.toThrow('require linked');

    const repeat = createTx([
      { id: 'vote-1', status: 'indicative', ballot_visibility: 'named' },
      { id: 'participation-old', vote_id: 'vote-1', voter_id: 'voter-1' },
      [{ id: 'old-decision' }],
    ]);
    await voteSharedMutators.replaceIndicativeVote.fn({
      tx: repeat as never, ctx, args: { participation, decisions: [decision] },
    });
    expect(repeat.mutate.indicative_choice_decision.delete).toHaveBeenCalledWith({
      id: 'old-decision',
    });
  });

  it('covers full final vote validation and ballot linkage', async () => {
    await expect(
      voteSharedMutators.castFinalVoteFull.fn({
        tx: createTx() as never, ctx,
        args: { voter: { ...voter, vote_id: 'other' }, participation, decisions: [] },
      })
    ).rejects.toThrow('does not match');

    const named = createTx([{ id: 'vote-1', status: 'final', ballot_visibility: 'named' }]);
    await voteSharedMutators.castFinalVoteFull.fn({
      tx: named as never, ctx, args: { participation, decisions: [decision] },
    });
    expect(named.mutate.final_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: 'participation-1' })
    );

    const secret = createTx([{ id: 'vote-1', status: 'final', ballot_visibility: 'secret' }]);
    await voteSharedMutators.castFinalVoteFull.fn({
      tx: secret as never, ctx,
      args: { participation, decisions: [{ ...decision, voter_participation_id: null }] },
    });
    expect(secret.mutate.final_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: null })
    );

    const wrong = createTx([{ id: 'vote-1', status: 'final' }]);
    await expect(
      voteSharedMutators.castFinalVoteFull.fn({
        tx: wrong as never, ctx,
        args: { participation, decisions: [{ ...decision, vote_id: 'other' }] },
      })
    ).rejects.toThrow('does not belong');
  });

  it('updates and inserts offline tallies and validates server deletion', async () => {
    const update = createTx([{ id: 'tally-1' }]);
    await voteSharedMutators.upsertOfflineTally.fn({
      tx: update as never, ctx,
      args: { id: 'tally-1', vote_id: 'vote-1', phase: 'final', choice_id: 'choice-1', count: 3 },
    });
    expect(update.mutate.vote_offline_tally.update).toHaveBeenCalled();

    const insert = createTx([null]);
    await voteSharedMutators.upsertOfflineTally.fn({
      tx: insert as never, ctx,
      args: { vote_id: 'vote-1', phase: 'final', choice_id: 'choice-1', count: 2 } as never,
    });
    expect(insert.mutate.vote_offline_tally.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) })
    );
    const insertWithId = createTx([null]);
    await voteSharedMutators.upsertOfflineTally.fn({
      tx: insertWithId as never,
      ctx,
      args: { id: 'tally-new', vote_id: 'vote-1', phase: 'final', choice_id: 'choice-1', count: 1 },
    });
    expect(insertWithId.mutate.vote_offline_tally.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tally-new' })
    );

    await expect(
      voteSharedMutators.deleteOfflineTally.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' },
      })
    ).rejects.toThrow('offline tally not found');

    const remove = createTx([
      { id: 'tally-1', vote_id: 'vote-1' },
      { id: 'vote-1', agenda_item_id: null, amendment_id: 'amendment-1' },
    ], 'server');
    await voteSharedMutators.deleteOfflineTally.fn({
      tx: remove as never, ctx, args: { id: 'tally-1' },
    });
    expect(remove.mutate.vote_offline_tally.delete).toHaveBeenCalledWith({ id: 'tally-1' });
  });
});
