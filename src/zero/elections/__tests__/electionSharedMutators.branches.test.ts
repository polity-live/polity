import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '../../rbac/errors';

const canMock = vi.hoisted(() => vi.fn());
vi.mock('../../rbac/can', () => ({ can: (...args: unknown[]) => canMock(...args) }));

import { electionSharedMutators } from '../shared-mutators';

function createTx(results: unknown[] = [], location: 'client' | 'server' = 'client') {
  const queue = [...results];
  const ops = () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() });
  return {
    clientID: 'client-1', mutationID: 1, reason: 'test', location,
    run: vi.fn(async () => queue.shift()),
    mutate: {
      election: ops(), election_candidate: ops(), elector: ops(),
      indicative_elector_participation: ops(), indicative_candidate_selection: ops(),
      final_elector_participation: ops(), final_candidate_selection: ops(),
      election_offline_tally: ops(),
    },
  };
}

const ctx = { userID: 'user-1', email: 'user-1@example.com' };
const elector = { id: 'elector-1', election_id: 'election-1', user_id: 'user-1' };
const participation = {
  id: 'participation-1', election_id: 'election-1', elector_id: 'elector-1',
};
const selection = {
  id: 'selection-1', election_id: 'election-1', candidate_id: 'candidate-1',
  elector_participation_id: 'participation-1',
};
const createArgs = {
  id: 'election-1', agenda_item_id: null, role_id: null, position_id: null,
  title: 'Election', description: null, status: 'indicative', majority_type: 'relative',
  closing_type: 'moderator', closing_duration_seconds: null, closing_end_time: null,
  visibility: 'public', ballot_visibility: null, election_mode: 'single', seat_count: 1,
  max_votes: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  canMock.mockResolvedValue(undefined);
});

describe('election shared mutator branch contracts', () => {
  it('runs optimistic CRUD, candidacy, elector, and selection facades on the client', async () => {
    const tx = createTx([
      { election_mode: 'single', seat_count: 1, max_votes: 1 },
      { election_mode: 'single', seat_count: 1, max_votes: 1 },
      { election_mode: 'single', seat_count: 1, max_votes: 1 },
      { election_mode: 'single', seat_count: 1, max_votes: 1 },
    ]);
    await electionSharedMutators.startElection.fn({ tx: tx as never, ctx, args: {} as never });
    await electionSharedMutators.submitElectionVote.fn({
      tx: tx as never, ctx, args: {} as never,
    });
    await electionSharedMutators.createElection.fn({
      tx: tx as never, ctx, args: createArgs as never,
    });
    await electionSharedMutators.updateElection.fn({
      tx: tx as never, ctx, args: { id: 'election-1' } as never,
    });
    await electionSharedMutators.updateElection.fn({
      tx: tx as never, ctx, args: { id: 'election-1', election_mode: 'list' } as never,
    });
    await electionSharedMutators.updateElection.fn({
      tx: tx as never, ctx, args: { id: 'election-1', seat_count: 3 } as never,
    });
    await electionSharedMutators.updateElection.fn({
      tx: tx as never, ctx, args: { id: 'election-1', max_votes: 2, position_id: 'role-2' } as never,
    });
    await electionSharedMutators.deleteElection.fn({
      tx: tx as never, ctx, args: { id: 'election-1' },
    });
    await electionSharedMutators.addCandidate.fn({
      tx: tx as never, ctx,
      args: { id: 'candidate-1', election_id: 'election-1', user_id: 'user-1', name: 'Ada' } as never,
    });
    await electionSharedMutators.updateCandidate.fn({
      tx: tx as never, ctx, args: { id: 'candidate-1', name: 'Ada Updated' } as never,
    });
    await electionSharedMutators.deleteCandidate.fn({
      tx: tx as never, ctx, args: { id: 'candidate-1' },
    });
    await electionSharedMutators.createElector.fn({ tx: tx as never, ctx, args: elector });
    await electionSharedMutators.deleteElector.fn({
      tx: tx as never, ctx, args: { id: 'elector-1' },
    });
    await electionSharedMutators.castIndicativeElectionVote.fn({
      tx: tx as never, ctx, args: participation,
    });
    await electionSharedMutators.createIndicativeCandidateSelection.fn({
      tx: tx as never, ctx, args: selection,
    });
    await electionSharedMutators.createIndicativeCandidateSelection.fn({
      tx: tx as never, ctx, args: { ...selection, elector_participation_id: null },
    });
    await electionSharedMutators.castFinalElectionVote.fn({
      tx: tx as never, ctx, args: participation,
    });
    await electionSharedMutators.createFinalCandidateSelection.fn({
      tx: tx as never, ctx, args: selection,
    });
    await electionSharedMutators.createFinalCandidateSelection.fn({
      tx: tx as never, ctx, args: { ...selection, elector_participation_id: null },
    });
    await electionSharedMutators.deleteOfflineTally.fn({
      tx: tx as never, ctx, args: { id: 'tally-1' },
    });

    expect(tx.mutate.election.insert).toHaveBeenCalled();
    expect(tx.mutate.election.update).toHaveBeenCalledTimes(4);
    expect(tx.mutate.election_candidate.insert).toHaveBeenCalled();
    expect(tx.mutate.indicative_elector_participation.insert).toHaveBeenCalled();
    expect(tx.mutate.final_elector_participation.insert).toHaveBeenCalled();
  });

  it('validates manager scopes, missing elections, and RBAC fallback', async () => {
    await expect(
      electionSharedMutators.deleteElection.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' },
      })
    ).rejects.toThrow('Election not found');
    await expect(
      electionSharedMutators.createElection.fn({
        tx: createTx([], 'server') as never, ctx,
        args: { ...createArgs, agenda_item_id: null } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const missingAgenda = createTx([null], 'server');
    await expect(
      electionSharedMutators.createElection.fn({
        tx: missingAgenda as never, ctx,
        args: { ...createArgs, agenda_item_id: 'missing' } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const fallback = createTx([{ id: 'agenda-1', event_id: 'event-1' }], 'server');
    canMock
      .mockRejectedValueOnce(new PermissionError('manage', 'elections', 'event-1'))
      .mockResolvedValueOnce(undefined);
    await electionSharedMutators.createElection.fn({
      tx: fallback as never, ctx,
      args: { ...createArgs, agenda_item_id: 'agenda-1' } as never,
    });
    expect(canMock).toHaveBeenLastCalledWith(
      fallback, ctx, { action: 'manage_votes', resource: 'events', eventId: 'event-1' }
    );

    canMock.mockRejectedValueOnce(new Error('rbac unavailable'));
    await expect(
      electionSharedMutators.createElection.fn({
        tx: createTx([{ id: 'agenda-1', event_id: 'event-1' }], 'server') as never,
        ctx,
        args: { ...createArgs, agenda_item_id: 'agenda-1' } as never,
      })
    ).rejects.toThrow('rbac unavailable');

    await expect(
      electionSharedMutators.deleteElection.fn({
        tx: createTx([
          { id: 'election-2', agenda_item_id: null },
        ], 'server') as never,
        ctx,
        args: { id: 'election-2' },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    await expect(
      electionSharedMutators.deleteElection.fn({
        tx: createTx([
          { id: 'election-3', agenda_item_id: 'missing' }, null,
        ], 'server') as never,
        ctx,
        args: { id: 'election-3' },
      })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('validates server candidate and frozen-elector records', async () => {
    await expect(
      electionSharedMutators.updateCandidate.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing', name: 'X' } as never,
      })
    ).rejects.toThrow('candidate not found');
    await expect(
      electionSharedMutators.deleteCandidate.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' },
      })
    ).rejects.toThrow('candidate not found');
    await expect(
      electionSharedMutators.castIndicativeElectionVote.fn({
        tx: createTx([], 'server') as never, ctx,
        args: { ...participation, elector_id: null } as never,
      })
    ).rejects.toThrow('Elector is required');
    await expect(
      electionSharedMutators.castIndicativeElectionVote.fn({
        tx: createTx([null], 'server') as never, ctx, args: participation,
      })
    ).rejects.toThrow('Elector not found');
    await expect(
      electionSharedMutators.castIndicativeElectionVote.fn({
        tx: createTx([{ ...elector, election_id: 'other' }], 'server') as never,
        ctx,
        args: participation,
      })
    ).rejects.toThrow('Elector not found');
    await expect(
      electionSharedMutators.castIndicativeElectionVote.fn({
        tx: createTx([
          elector,
          { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
          { id: 'agenda-1', event_id: 'event-1' },
        ], 'server') as never,
        ctx,
        args: participation,
      })
    ).rejects.toThrow('not been snapshotted');
    await expect(
      electionSharedMutators.createIndicativeCandidateSelection.fn({
        tx: createTx([null], 'server') as never, ctx, args: selection,
      })
    ).rejects.toThrow('candidate not found');
    await expect(
      electionSharedMutators.createIndicativeCandidateSelection.fn({
        tx: createTx([{ id: 'candidate-1', election_id: 'other' }], 'server') as never,
        ctx,
        args: selection,
      })
    ).rejects.toThrow('candidate not found');
    await expect(
      electionSharedMutators.createElector.fn({
        tx: createTx([], 'server') as never, ctx, args: elector,
      })
    ).rejects.toThrow('server-side electorate snapshot');
    await expect(
      electionSharedMutators.deleteElector.fn({
        tx: createTx([], 'server') as never, ctx, args: { id: 'elector-1' },
      })
    ).rejects.toThrow('server-side electorate snapshot');
  });

  it('validates linked indicative and final participation ownership on the server', async () => {
    const candidate = { id: 'candidate-1', election_id: 'election-1' };
    await expect(
      electionSharedMutators.createIndicativeCandidateSelection.fn({
        tx: createTx([candidate, null], 'server') as never, ctx, args: selection,
      })
    ).rejects.toThrow('participation not found');
    await expect(
      electionSharedMutators.createIndicativeCandidateSelection.fn({
        tx: createTx([
          candidate, { ...participation, user_id: 'user-2' },
        ], 'server') as never,
        ctx,
        args: selection,
      })
    ).rejects.toThrow('does not own');
    const indicative = createTx([
      candidate, { ...participation, user_id: ctx.userID },
    ], 'server');
    await electionSharedMutators.createIndicativeCandidateSelection.fn({
      tx: indicative as never, ctx, args: selection,
    });
    expect(indicative.mutate.indicative_candidate_selection.insert).toHaveBeenCalled();

    await expect(
      electionSharedMutators.createFinalCandidateSelection.fn({
        tx: createTx([candidate, null], 'server') as never, ctx, args: selection,
      })
    ).rejects.toThrow('participation not found');
    await expect(
      electionSharedMutators.createFinalCandidateSelection.fn({
        tx: createTx([
          candidate, { ...participation, elector_id: null },
        ], 'server') as never,
        ctx,
        args: selection,
      })
    ).rejects.toThrow('Elector is missing');
    const final = createTx([
      candidate,
      participation,
      elector,
      { id: 'election-1', agenda_item_id: null, electorate_snapshotted_at: 1 },
    ], 'server');
    await electionSharedMutators.createFinalCandidateSelection.fn({
      tx: final as never, ctx, args: selection,
    });
    expect(final.mutate.final_candidate_selection.insert).toHaveBeenCalled();
  });

  it('covers manager and active-right fallbacks while ensuring elector rows', async () => {
    const noEvent = createTx([
      { id: 'election-1', agenda_item_id: null },
      { id: 'election-1', agenda_item_id: null },
    ], 'server');
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: noEvent as never, ctx, args: { elector, participation, selections: [] },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const unexpected = createTx([
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    canMock.mockRejectedValueOnce(new Error('active rights unavailable'));
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: unexpected as never, ctx, args: { elector, participation, selections: [] },
      })
    ).rejects.toThrow('active rights unavailable');

    const mismatch = createTx([
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'elector-1', election_id: 'other', user_id: 'user-1' },
    ], 'server');
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: mismatch as never, ctx, args: { elector, participation, selections: [] },
      })
    ).rejects.toThrow('already used');

    const userMismatch = createTx([
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'elector-1', election_id: 'election-1', user_id: 'user-2' },
    ], 'server');
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: userMismatch as never, ctx, args: { elector, participation, selections: [] },
      })
    ).rejects.toThrow('already used');
  });

  it('reuses matching elector ids and per-user electorate rows and inserts local electorates', async () => {
    const matching = createTx([
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      elector,
      elector,
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'election-1', ballot_visibility: 'named' },
      null,
    ], 'server');
    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: matching as never, ctx, args: { elector, participation, selections: [] },
    });
    expect(matching.mutate.elector.insert).not.toHaveBeenCalled();

    const byUser = createTx([
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'elector-existing', election_id: 'election-1', user_id: 'user-1' },
      { id: 'elector-existing', election_id: 'election-1', user_id: 'user-1' },
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'election-1', ballot_visibility: 'named' },
      null,
    ], 'server');
    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: byUser as never, ctx, args: { elector, participation, selections: [] },
    });
    expect(byUser.mutate.elector.insert).not.toHaveBeenCalled();
  });

  it('covers unlinked secret selection ownership and manager fallback', async () => {
    const candidate = { id: 'candidate-1', election_id: 'election-1' };
    const finalOwner = createTx([
      candidate,
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      elector,
      elector,
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      participation,
    ], 'server');
    await electionSharedMutators.createFinalCandidateSelection.fn({
      tx: finalOwner as never, ctx,
      args: { ...selection, elector_participation_id: null },
    });
    expect(finalOwner.mutate.final_candidate_selection.insert).toHaveBeenCalled();

    const managerFallback = createTx([
      candidate,
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    await electionSharedMutators.createFinalCandidateSelection.fn({
      tx: managerFallback as never, ctx,
      args: { ...selection, elector_participation_id: null },
    });
    expect(managerFallback.mutate.final_candidate_selection.insert).toHaveBeenCalled();

    const missingFinalParticipation = createTx([
      candidate,
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
      elector,
      elector,
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 1 },
      { id: 'agenda-1', event_id: 'event-1' },
      null,
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    await electionSharedMutators.createFinalCandidateSelection.fn({
      tx: missingFinalParticipation as never, ctx,
      args: { ...selection, elector_participation_id: null },
    });
    expect(missingFinalParticipation.mutate.final_candidate_selection.insert).toHaveBeenCalled();

    const indicativeFallback = createTx([
      candidate,
      { id: 'election-1', agenda_item_id: null },
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    await electionSharedMutators.createIndicativeCandidateSelection.fn({
      tx: indicativeFallback as never, ctx,
      args: { ...selection, elector_participation_id: null },
    });
    expect(indicativeFallback.mutate.indicative_candidate_selection.insert).toHaveBeenCalled();
  });

  it('covers client indicative replacement validation and named/secret persistence', async () => {
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: createTx() as never, ctx,
        args: { participation: { ...participation, elector_id: null }, selections: [] } as never,
      })
    ).rejects.toThrow('Elector is required');
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: createTx() as never, ctx,
        args: { elector: { ...elector, id: 'other' }, participation, selections: [] },
      })
    ).rejects.toThrow('does not match');

    const named = createTx([
      { id: 'election-1', ballot_visibility: 'named' }, null,
    ]);
    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: named as never, ctx, args: { elector, participation, selections: [selection] },
    });
    expect(named.mutate.elector.insert).toHaveBeenCalled();
    expect(named.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({ elector_participation_id: 'participation-1' })
    );

    const secret = createTx([
      { id: 'election-1', ballot_visibility: 'secret' }, null,
    ]);
    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: secret as never, ctx,
      args: { participation, selections: [{ ...selection, elector_participation_id: null }] },
    });
    expect(secret.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({ elector_participation_id: null })
    );

    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: createTx([{ id: 'election-1' }]) as never, ctx,
        args: { participation, selections: [{ ...selection, election_id: 'other' }] },
      })
    ).rejects.toThrow('does not belong');
    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: createTx([{ id: 'election-1', ballot_visibility: 'named' }, null]) as never,
        ctx,
        args: { participation, selections: [{ ...selection, elector_participation_id: null }] },
      })
    ).rejects.toThrow('require linked');

    const repeat = createTx([
      { id: 'election-1', ballot_visibility: 'named' },
      { id: 'participation-old' },
      [{ id: 'old-selection' }],
    ]);
    await electionSharedMutators.replaceIndicativeElectionVote.fn({
      tx: repeat as never, ctx, args: { participation, selections: [selection] },
    });
    expect(repeat.mutate.indicative_candidate_selection.delete).toHaveBeenCalledWith({
      id: 'old-selection',
    });
  });

  it('covers full final election validation and ballot linkage', async () => {
    await expect(
      electionSharedMutators.castFinalElectionVoteFull.fn({
        tx: createTx() as never, ctx,
        args: { elector: { ...elector, election_id: 'other' }, participation, selections: [] },
      })
    ).rejects.toThrow('does not match');

    const named = createTx([{ id: 'election-1', ballot_visibility: 'named' }]);
    await electionSharedMutators.castFinalElectionVoteFull.fn({
      tx: named as never, ctx, args: { participation, selections: [selection] },
    });
    expect(named.mutate.final_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({ elector_participation_id: 'participation-1' })
    );

    const secret = createTx([{ id: 'election-1', ballot_visibility: 'secret' }]);
    await electionSharedMutators.castFinalElectionVoteFull.fn({
      tx: secret as never, ctx,
      args: { participation, selections: [{ ...selection, elector_participation_id: null }] },
    });
    expect(secret.mutate.final_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({ elector_participation_id: null })
    );

    await expect(
      electionSharedMutators.castFinalElectionVoteFull.fn({
        tx: createTx([{ id: 'election-1' }]) as never, ctx,
        args: { participation, selections: [{ ...selection, election_id: 'other' }] },
      })
    ).rejects.toThrow('does not belong');
  });

  it('updates and inserts election offline tallies and validates deletion', async () => {
    const update = createTx([{ id: 'tally-1' }]);
    await electionSharedMutators.upsertOfflineTally.fn({
      tx: update as never, ctx,
      args: { id: 'tally-1', election_id: 'election-1', phase: 'final', candidate_id: 'candidate-1', count: 3 },
    });
    expect(update.mutate.election_offline_tally.update).toHaveBeenCalled();
    const insert = createTx([null]);
    await electionSharedMutators.upsertOfflineTally.fn({
      tx: insert as never, ctx,
      args: { election_id: 'election-1', phase: 'final', candidate_id: 'candidate-1', count: 2 } as never,
    });
    expect(insert.mutate.election_offline_tally.insert).toHaveBeenCalled();

    await expect(
      electionSharedMutators.deleteOfflineTally.fn({
        tx: createTx([null], 'server') as never, ctx, args: { id: 'missing' },
      })
    ).rejects.toThrow('offline tally not found');
    const remove = createTx([
      { id: 'tally-1', election_id: 'election-1' },
      { id: 'election-1', agenda_item_id: 'agenda-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ], 'server');
    await electionSharedMutators.deleteOfflineTally.fn({
      tx: remove as never, ctx, args: { id: 'tally-1' },
    });
    expect(remove.mutate.election_offline_tally.delete).toHaveBeenCalled();
  });
});
