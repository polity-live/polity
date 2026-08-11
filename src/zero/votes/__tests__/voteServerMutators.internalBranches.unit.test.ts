import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createVote: vi.fn(),
  updateVote: vi.fn(),
  castIndicativeVote: vi.fn(),
  castFinalVote: vi.fn(),
  createFinalChoiceDecision: vi.fn(),
  upsertOfflineTally: vi.fn(),
  replaceIndicativeVote: vi.fn(),
  castFinalVoteFull: vi.fn(),
  eventAllowsOnlineVoting: vi.fn(),
  isUserForcedOfflineForEvent: vi.fn(),
  getConfirmedOfflineAttendeeCount: vi.fn(),
  getHybridOfflineOverrideUserIdsForEvent: vi.fn(),
  eventTitle: vi.fn(),
  isOwnedTutorial: vi.fn(),
  recomputeEventCounters: vi.fn(),
  requireRecentPassword: vi.fn(),
  fireNotification: vi.fn(),
  resolveAmendmentProcessVote: vi.fn(),
  notifyProcessVoteResolution: vi.fn(),
  finalizeInternalChangeRequests: vi.fn(),
  resolveChangeRequestByVoteResult: vi.fn(),
  materializeCurrentVoting: vi.fn(),
  assertEligibility: vi.fn(),
  snapshotElectorate: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    votes: {
      createVote: { fn: mocks.createVote },
      updateVote: { fn: mocks.updateVote },
      castIndicativeVote: { fn: mocks.castIndicativeVote },
      castFinalVote: { fn: mocks.castFinalVote },
      createFinalChoiceDecision: { fn: mocks.createFinalChoiceDecision },
      upsertOfflineTally: { fn: mocks.upsertOfflineTally },
      replaceIndicativeVote: { fn: mocks.replaceIndicativeVote },
      castFinalVoteFull: { fn: mocks.castFinalVoteFull },
    },
  },
}));
vi.mock('../../offline-roster-helpers', () => ({
  eventAllowsOnlineVoting: mocks.eventAllowsOnlineVoting,
  isUserForcedOfflineForEvent: mocks.isUserForcedOfflineForEvent,
  getConfirmedOfflineAttendeeCount: mocks.getConfirmedOfflineAttendeeCount,
  getHybridOfflineOverrideUserIdsForEvent: mocks.getHybridOfflineOverrideUserIdsForEvent,
}));
vi.mock('../../server-helpers', () => ({
  eventTitle: mocks.eventTitle,
  isOwnedAppTutorialAgendaItem: mocks.isOwnedTutorial,
  recomputeEventCounters: mocks.recomputeEventCounters,
  requireRecentVotingPasswordVerification: mocks.requireRecentPassword,
}));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../amendments/process-engine', () => ({
  resolveAmendmentProcessVote: mocks.resolveAmendmentProcessVote,
}));
vi.mock('../../amendments/process-notifications', () => ({
  notifyProcessVoteResolution: mocks.notifyProcessVoteResolution,
}));
vi.mock('../../change-requests/internal-voting', () => ({
  finalizeInternalChangeRequestsForEventPhaseTransition: mocks.finalizeInternalChangeRequests,
}));
vi.mock('../../change-requests/server-resolution', () => ({
  resolveChangeRequestByVoteResult: mocks.resolveChangeRequestByVoteResult,
}));
vi.mock('../../agendas/server-mutators', () => ({
  materializeCurrentForwardConfirmedEventVoting: mocks.materializeCurrentVoting,
}));
vi.mock('../../ballot-eligibility', () => ({
  assertCurrentOnlineBallotEligibility: mocks.assertEligibility,
  snapshotVoteElectorate: mocks.snapshotElectorate,
}));

import { voteServerMutatorTestApi as api, voteServerMutators } from '../server-mutators';

function txWith(rows: unknown[] = []) {
  const queue = [...rows];
  return {
    run: vi.fn(async () => queue.shift()),
    mutate: {
      amendment: { update: vi.fn() },
      amendment_process_branch: { update: vi.fn() },
      agenda_item_change_request: { update: vi.fn() },
      agenda_item: { update: vi.fn() },
      vote: { update: vi.fn() },
      indicative_voter_participation: { insert: vi.fn() },
      indicative_choice_decision: { insert: vi.fn(), delete: vi.fn() },
    },
  };
}

const ctx = { userID: 'user-1', email: 'user@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventAllowsOnlineVoting.mockResolvedValue(true);
  mocks.isUserForcedOfflineForEvent.mockResolvedValue(false);
  mocks.getConfirmedOfflineAttendeeCount.mockResolvedValue(0);
  mocks.getHybridOfflineOverrideUserIdsForEvent.mockResolvedValue([]);
  mocks.eventTitle.mockResolvedValue('Event');
  mocks.isOwnedTutorial.mockResolvedValue(false);
  mocks.requireRecentPassword.mockResolvedValue(undefined);
  mocks.resolveAmendmentProcessVote.mockResolvedValue({ handled: false });
});

describe('vote server pure helpers', () => {
  it('normalizes statuses, majority types, and choice labels', () => {
    expect(api.isFinalizingVoteStatus('final')).toBe(true);
    expect(api.isFinalizingVoteStatus('closed')).toBe(true);
    expect(api.isFinalizingVoteStatus('indicative')).toBe(false);
    expect(api.normalizeMajorityType('absolute')).toBe('absolute');
    expect(api.normalizeMajorityType('two_thirds')).toBe('two_thirds');
    expect(api.normalizeMajorityType('unknown')).toBe('simple');
    expect(api.normalizeMajorityType(null)).toBe('simple');
    expect(api.normalizeChoiceLabel(' YES ')).toBe('yes');
    expect(api.normalizeChoiceLabel(null)).toBeNull();
    expect(api.isAcceptChoice('accept')).toBe(true);
    expect(api.isAcceptChoice('yes')).toBe(true);
    expect(api.isAcceptChoice('no')).toBe(false);
    expect(api.isRejectChoice('reject')).toBe(true);
    expect(api.isRejectChoice('no')).toBe(true);
    expect(api.isRejectChoice('yes')).toBe(false);
  });

  it('identifies only eligible event votes for returning to suggesting mode', () => {
    const normal = { isChangeRequestVote: false, isFinalChangeRequestVote: false };
    expect(api.shouldReturnEventVoteToSuggesting({}, normal)).toBe(false);
    expect(
      api.shouldReturnEventVoteToSuggesting(
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1', purpose: 'closing' },
        normal
      )
    ).toBe(false);
    expect(
      api.shouldReturnEventVoteToSuggesting(
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1', purpose: 'merge_variant' },
        normal
      )
    ).toBe(true);
    expect(
      api.shouldReturnEventVoteToSuggesting(
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1', purpose: 'change_request' },
        normal
      )
    ).toBe(true);
    expect(
      api.shouldReturnEventVoteToSuggesting(
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' },
        { isChangeRequestVote: true, isFinalChangeRequestVote: false }
      )
    ).toBe(true);
    expect(
      api.shouldReturnEventVoteToSuggesting(
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' },
        { isChangeRequestVote: true, isFinalChangeRequestVote: true }
      )
    ).toBe(false);
  });
});

describe('vote server eligibility and tally helpers', () => {
  it('allows unlinked and online votes and rejects offline-only paths', async () => {
    await api.assertOnlineVoteAllowed(txWith([null]) as never, {
      voteId: 'vote-1',
      userId: 'user-1',
    });
    await api.assertOnlineVoteAllowed(txWith([{ agenda_item_id: 'agenda-1' }, null]) as never, {
      voteId: 'vote-1',
      userId: 'user-1',
    });
    await api.assertOnlineVoteAllowed(
      txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
      { voteId: 'vote-1', userId: 'user-1' }
    );

    mocks.eventAllowsOnlineVoting.mockResolvedValueOnce(false);
    await expect(
      api.assertOnlineVoteAllowed(
        txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
        { voteId: 'vote-1', userId: 'user-1' }
      )
    ).rejects.toThrow(/offline tally flow/i);
    mocks.isUserForcedOfflineForEvent.mockResolvedValueOnce(true);
    await expect(
      api.assertOnlineVoteAllowed(
        txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
        { voteId: 'vote-1', userId: 'user-1' }
      )
    ).rejects.toThrow(/offline tally flow/i);
  });

  it('supports legacy array counts, snapshot counts, phase filtering, and replacement tallies', async () => {
    const args = {
      voteId: 'vote-1',
      phase: 'final' as const,
      nextChoiceId: 'choice-1',
      nextCount: 1,
    };
    await expect(
      api.assertOfflineVoteTallyWithinCap(txWith([null]) as never, args)
    ).rejects.toThrow(/not linked/i);

    await api.assertOfflineVoteTallyWithinCap(
      txWith([
        { agenda_item_id: 'agenda-1' },
        { event_id: 'event-1' },
        [{ id: 'offline-1' }],
        [{ phase: 'indicative', choice_id: 'choice-1', count: 20 }],
      ]) as never,
      args
    );

    await api.assertOfflineVoteTallyWithinCap(
      txWith([
        { agenda_item_id: 'agenda-1' },
        { event_id: 'event-1' },
        { offline_electorate_size: 2 },
        [{ phase: 'final', choice_id: 'choice-1', count: 2 }],
      ]) as never,
      { ...args, nextCount: 2 }
    );

    await expect(
      api.assertOfflineVoteTallyWithinCap(
        txWith([
          { agenda_item_id: 'agenda-1' },
          { event_id: 'event-1' },
          { offline_electorate_size: null },
          [{ phase: 'final', choice_id: 'other', count: 1 }],
        ]) as never,
        args
      )
    ).rejects.toThrow(/cannot exceed/i);
  });
});

describe('vote server change-request sequencing helpers', () => {
  it('enforces closing and configured timeline order with and without titles', async () => {
    await api.assertCurrentCRVoteOrder(txWith([null]) as never, {
      id: 'current',
      agenda_item_id: 'agenda-1',
      is_closing_vote: false,
    });

    await expect(
      api.assertCurrentCRVoteOrder(
        txWith([[{ id: 'first', is_closing_vote: false, status: 'open' }]]) as never,
        { id: 'closing', agenda_item_id: 'agenda-1', is_closing_vote: true }
      )
    ).rejects.toThrow(/must be completed/i);

    await expect(
      api.assertCurrentCRVoteOrder(
        txWith([
          [
            {
              id: 'first',
              is_closing_vote: false,
              status: 'open',
              change_request: { title: ' First CR ' },
            },
          ],
        ]) as never,
        { id: 'second', agenda_item_id: 'agenda-1', is_closing_vote: false }
      )
    ).rejects.toThrow(/First CR/i);

    await expect(
      api.assertCurrentCRVoteOrder(
        txWith([[{ id: 'first', is_closing_vote: false, status: 'open' }]]) as never,
        { id: 'second', agenda_item_id: 'agenda-1', is_closing_vote: false }
      )
    ).rejects.toThrow(/first unfinished/i);

    await api.assertCurrentCRVoteOrder(
      txWith([[{ id: 'current', is_closing_vote: false, status: 'open' }]]) as never,
      { id: 'current', agenda_item_id: 'agenda-1', is_closing_vote: false }
    );
  });

  it('finds process branches from links, choices, and agenda step fallbacks', async () => {
    expect(
      await api.findProcessBranchIdForAgendaItem(txWith([null]) as never, 'agenda-1')
    ).toBeNull();
    expect(
      await api.findProcessBranchIdForAgendaItem(
        txWith([{ branch_id: 'branch-1' }]) as never,
        'agenda-1'
      )
    ).toBe('branch-1');

    expect(
      await api.findProcessBranchIdsForVote(
        txWith([
          { process_branch_id: 'branch-1' },
          [
            { process_branch_id: 'branch-1' },
            { process_branch_id: 'branch-2' },
            { process_branch_id: null },
          ],
        ]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1' }
      )
    ).toEqual(['branch-1', 'branch-2']);

    expect(
      await api.findProcessBranchIdsForVote(
        txWith([null, null, [{ branch_id: 'branch-3' }, { branch_id: null }]]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1' }
      )
    ).toEqual(['branch-3']);

    expect(
      await api.findProcessBranchIdsForVote(txWith([null, []]) as never, {
        id: 'vote-1',
        agenda_item_id: null,
      })
    ).toEqual([]);

    expect(
      await api.findProcessBranchIdsForVote(txWith([null, [], null]) as never, {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
      })
    ).toEqual([]);
  });

  it('rejects competing final and open variant votes', async () => {
    expect(
      await api.assertNoOpenChangeRequestsBeforeFinalVote(txWith() as never, {
        id: 'vote-1',
        agenda_item_id: null,
      })
    ).toEqual({ isChangeRequestVote: false, isFinalChangeRequestVote: false });

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([[{ id: 'other', status: 'final' }]]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1' }
      )
    ).rejects.toThrow(/another final vote/i);

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([[{ id: 'variant', purpose: 'merge_variant', status: 'indicative' }]]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', purpose: 'change_request' }
      )
    ).rejects.toThrow(/variant final vote/i);
  });

  it('handles linked closing-vote submissions and returns linked context', async () => {
    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([
          [],
          { id: 'link-1', is_closing_vote: true, agenda_item_id: 'agenda-1' },
          { branch_id: 'branch-1' },
          [
            {
              status: 'pending_submission',
              process_branch_id: 'branch-1',
            },
          ],
        ]) as never,
        {
          id: 'vote-1',
          agenda_item_id: 'agenda-1',
          amendment_id: 'amendment-1',
          purpose: 'closing',
        }
      )
    ).rejects.toThrow(/pending change request submissions/i);

    const result = await api.assertNoOpenChangeRequestsBeforeFinalVote(
      txWith([
        [],
        { id: 'link-1', is_closing_vote: false, agenda_item_id: 'agenda-1' },
        [{ id: 'link-1', is_closing_vote: false, status: 'open' }],
      ]) as never,
      { id: 'vote-1', agenda_item_id: 'agenda-1' }
    );
    expect(result).toEqual({ isChangeRequestVote: true, isFinalChangeRequestVote: false });

    await api.assertNoOpenChangeRequestsBeforeFinalVote(
      txWith([
        [],
        { id: 'link-2', is_closing_vote: true, agenda_item_id: 'agenda-1' },
        null,
        null,
        [],
      ]) as never,
      {
        id: 'vote-2',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'closing',
      }
    );

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([
          [],
          { id: 'link-3', is_closing_vote: true, agenda_item_id: 'agenda-1' },
          null,
          [
            {
              status: 'open',
              voting_status: 'pending_submission',
              process_branch_id: null,
            },
          ],
        ]) as never,
        {
          id: 'vote-3',
          agenda_item_id: 'agenda-1',
          amendment_id: 'amendment-1',
          purpose: 'closing',
        }
      )
    ).rejects.toThrow(/pending change request submissions/i);
  });

  it('rejects pending timeline items, pending submissions, and open branch requests', async () => {
    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([[], null, [], [{ is_closing_vote: false, status: 'open' }]]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1' }
      )
    ).rejects.toThrow(/must be completed/i);

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([
          [],
          null,
          [],
          [],
          { branch_id: null },
          [{ voting_status: 'pending_submission', process_branch_id: null }],
        ]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toThrow(/pending change request submissions/i);

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([
          [],
          null,
          [],
          [],
          { branch_id: 'branch-1' },
          [],
          [{ process_branch_id: 'branch-1' }],
        ]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toThrow(/open change requests/i);

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([[], null, [], [], { branch_id: null }, [], [{ process_branch_id: null }]]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toThrow(/open change requests/i);

    expect(
      await api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([[], null, [{ step_kind: 'merge_vote' }]]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', purpose: 'merge_variant' }
      )
    ).toEqual({ isChangeRequestVote: false, isFinalChangeRequestVote: false });

    expect(
      await api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([null, null, null, null, null, null, null]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).toEqual({ isChangeRequestVote: false, isFinalChangeRequestVote: false });

    await expect(
      api.assertNoOpenChangeRequestsBeforeFinalVote(
        txWith([
          [],
          null,
          [],
          [],
          { branch_id: 'branch-1' },
          [
            {
              status: 'open',
              voting_status: 'pending_submission',
              process_branch_id: 'branch-1',
            },
          ],
        ]) as never,
        { id: 'vote-1', agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toThrow(/pending change request submissions/i);
  });
});

describe('vote server result and lifecycle helpers', () => {
  it('loads standalone and linked vote contexts', async () => {
    expect(
      await api.loadVoteContext(txWith() as never, { id: 'vote-1', agenda_item_id: null })
    ).toEqual({ isChangeRequestVote: false, isFinalChangeRequestVote: false });
    expect(
      await api.loadVoteContext(txWith([null]) as never, {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
      })
    ).toEqual({ isChangeRequestVote: false, isFinalChangeRequestVote: false });
    expect(
      await api.loadVoteContext(txWith([{ is_closing_vote: true }]) as never, {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
      })
    ).toEqual({ isChangeRequestVote: true, isFinalChangeRequestVote: true });
  });

  it('counts snapshot voters, online participation, and non-negative final offline tallies', async () => {
    expect(
      await api.loadEligibleFinalVoteCounts(txWith() as never, {
        id: 'vote-1',
        agenda_item_id: null,
      })
    ).toEqual({ eligibleFinalVoterCount: 0, recordedFinalVoteCount: 0 });
    expect(
      await api.loadEligibleFinalVoteCounts(txWith([null]) as never, {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
      })
    ).toEqual({ eligibleFinalVoterCount: 0, recordedFinalVoteCount: 0 });

    const snapshot = await api.loadEligibleFinalVoteCounts(
      txWith([
        { event_id: 'event-1' },
        [
          { id: 'voter-1', user_id: 'user-1', participation_channel: 'online' },
          { id: 'voter-2', user_id: 'user-2', participation_channel: 'offline' },
          { id: null, user_id: 'invalid', participation_channel: 'online' },
        ],
        [{ voter_id: 'voter-1' }, { voter_id: 'voter-2' }, { voter_id: 'missing' }],
        [
          { phase: 'indicative', count: 9 },
          { phase: 'final', count: -2 },
          { phase: 'final', count: null },
          { phase: 'final', count: 1 },
        ],
      ]) as never,
      { id: 'vote-1', agenda_item_id: 'agenda-1', offline_electorate_size: 2 }
    );
    expect(snapshot).toEqual({ eligibleFinalVoterCount: 4, recordedFinalVoteCount: 2 });
  });

  it('counts legacy voters and uses the larger recorded-vote total', async () => {
    mocks.getConfirmedOfflineAttendeeCount.mockResolvedValueOnce(2);
    const result = await api.loadEligibleFinalVoteCounts(
      txWith([
        { event_id: 'event-1' },
        [],
        [
          { id: 'voter-1', user_id: 'user-1' },
          { id: 'voter-2', user_id: 'user-2' },
        ],
        [{ voter_id: 'voter-1' }, { voter_id: 'voter-2' }],
        [{ phase: 'final', count: 2 }],
      ]) as never,
      { id: 'vote-1', agenda_item_id: 'agenda-1', offline_electorate_size: null }
    );
    expect(result).toEqual({ eligibleFinalVoterCount: 4, recordedFinalVoteCount: 4 });
  });

  it('closes only standalone agenda votes', async () => {
    const missing = txWith();
    await api.syncAgendaItemClosedForAgendaVote(
      missing as never,
      { agenda_item_id: null },
      { isChangeRequestVote: false, isFinalChangeRequestVote: false },
      1
    );
    const linked = txWith();
    await api.syncAgendaItemClosedForAgendaVote(
      linked as never,
      { agenda_item_id: 'agenda-1' },
      { isChangeRequestVote: true, isFinalChangeRequestVote: false },
      1
    );
    const standalone = txWith();
    await api.syncAgendaItemClosedForAgendaVote(
      standalone as never,
      { agenda_item_id: 'agenda-1' },
      { isChangeRequestVote: false, isFinalChangeRequestVote: false },
      1
    );
    expect(standalone.mutate.agenda_item.update).toHaveBeenCalledWith(
      expect.objectContaining({ voting_phase: 'closed' })
    );
  });

  it('auto-closes only when a final vote has a complete nonempty electorate', async () => {
    const updateSpy = vi.spyOn(voteServerMutators.updateVote, 'fn').mockResolvedValue(undefined);
    await api.maybeCloseVoteWhenAllFinalVotersVoted(
      txWith([null]) as never,
      ctx as never,
      'vote-1'
    );
    await api.maybeCloseVoteWhenAllFinalVotersVoted(
      txWith([{ id: 'vote-1', status: 'indicative' }]) as never,
      ctx as never,
      'vote-1'
    );
    await api.maybeCloseVoteWhenAllFinalVotersVoted(
      txWith([{ id: 'vote-1', status: 'final', agenda_item_id: null }]) as never,
      ctx as never,
      'vote-1'
    );
    expect(updateSpy).not.toHaveBeenCalled();

    await api.maybeCloseVoteWhenAllFinalVotersVoted(
      txWith([
        { id: 'vote-1', status: 'final', agenda_item_id: 'agenda-1', offline_electorate_size: 1 },
        { event_id: 'event-1' },
        [],
        [],
        [{ phase: 'final', count: 1 }],
      ]) as never,
      ctx as never,
      'vote-1'
    );
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ args: expect.objectContaining({ closed_reason: 'all_voters' }) })
    );
    updateSpy.mockRestore();
  });

  it('synchronizes unique mutable process branches and skips terminal or unchanged branches', async () => {
    await api.syncVoteEventEditingMode(txWith() as never, ctx, null, ['branch-1'], 'suggest_event');
    await api.syncVoteEventEditingMode(txWith() as never, ctx, 'amendment-1', [], 'suggest_event');
    const tx = txWith([
      null,
      { id: 'branch-passed', editing_mode: 'passed' },
      { id: 'branch-rejected', editing_mode: 'rejected' },
      { id: 'branch-same', editing_mode: 'suggest_event' },
      { id: 'branch-open', editing_mode: 'event_final_closing_vote' },
    ]);
    await api.syncVoteEventEditingMode(
      tx as never,
      ctx,
      'amendment-1',
      ['missing', 'branch-passed', 'branch-rejected', 'branch-same', 'branch-open', 'branch-open'],
      'suggest_event'
    );
    expect(mocks.finalizeInternalChangeRequests).toHaveBeenCalledTimes(1);
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch-open', editing_mode: 'suggest_event' })
    );
  });

  it('summarizes named, fallback, sparse, and offline choices', async () => {
    const named = await api.summarizeFinalVoteResult(
      txWith([
        [
          { id: 'reject', label: 'No', order_index: 2 },
          { id: 'accept', label: 'Yes', order_index: 1 },
        ],
        [{ choice_id: 'accept' }, { choice_id: null }],
        [{ participation_channel: 'online' }, { participation_channel: 'offline' }],
        [
          { phase: 'indicative', choice_id: 'reject', count: 8 },
          { phase: 'final', choice_id: 'reject', count: null },
        ],
      ]) as never,
      { id: 'vote-1', majority_type: 'absolute', offline_electorate_size: 1 }
    );
    expect(named).toEqual(expect.objectContaining({ acceptVotes: 1, rejectVotes: 0 }));

    const fallback = await api.summarizeFinalVoteResult(
      txWith([
        [
          { id: 'first', label: null, order_index: null },
          { id: 'second', label: 'Maybe', order_index: null },
        ],
        [],
        [],
        [],
      ]) as never,
      { id: 'vote-1', majority_type: null, offline_electorate_size: null }
    );
    expect(fallback).toEqual(expect.objectContaining({ acceptVotes: 0, rejectVotes: 0 }));

    const empty = await api.summarizeFinalVoteResult(txWith([[], [], [], []]) as never, {
      id: 'vote-1',
      majority_type: 'two_thirds',
      offline_electorate_size: 0,
    });
    expect(empty).toEqual(expect.objectContaining({ acceptVotes: 0, rejectVotes: 0 }));
  });

  it('materializes explicit, argument, vote, event, and invalid closing durations', async () => {
    const explicit = { closing_end_time: 100, closing_duration_seconds: 5 };
    expect(await api.materializeFinalVoteTiming(txWith() as never, {}, explicit)).toBe(explicit);
    expect(
      await api.materializeFinalVoteTiming(txWith() as never, {}, { closing_duration_seconds: 2.9 })
    ).toEqual(
      expect.objectContaining({ closing_duration_seconds: 2, closing_end_time: expect.any(Number) })
    );
    expect(
      await api.materializeFinalVoteTiming(txWith() as never, { closing_duration_seconds: 3.9 }, {})
    ).toEqual(expect.objectContaining({ closing_duration_seconds: 3 }));
    expect(
      await api.materializeFinalVoteTiming(
        txWith([{ event_id: 'event-1' }, { default_final_vote_duration_seconds: 4 }]) as never,
        { agenda_item_id: 'agenda-1', closing_duration_seconds: null },
        {}
      )
    ).toEqual(expect.objectContaining({ closing_duration_seconds: 4 }));
    expect(
      await api.materializeFinalVoteTiming(
        txWith([null]) as never,
        { agenda_item_id: 'agenda-1' },
        {}
      )
    ).toEqual({});
    expect(
      await api.materializeFinalVoteTiming(
        txWith([{ event_id: 'event-1' }, null]) as never,
        { agenda_item_id: 'agenda-1' },
        {}
      )
    ).toEqual({});
    for (const duration of [0, -1, Number.POSITIVE_INFINITY]) {
      expect(
        await api.materializeFinalVoteTiming(
          txWith() as never,
          {},
          { closing_duration_seconds: duration }
        )
      ).toEqual({ closing_duration_seconds: duration });
    }
  });

  it('marks absent, tied, linked, and standalone timeline results', async () => {
    expect(
      await api.markTimelineVoteResult(
        txWith([null]) as never,
        ctx as never,
        { id: 'vote-1' },
        'passed',
        1
      )
    ).toBeNull();
    const tied = txWith([{ id: 'link-1' }]);
    await api.markTimelineVoteResult(tied as never, ctx as never, { id: 'vote-1' }, 'tie', 1);
    expect(tied.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blocked_tie' })
    );
    const linked = txWith([{ id: 'link-1', change_request_id: 'cr-1' }]);
    await api.markTimelineVoteResult(linked as never, ctx as never, { id: 'vote-1' }, 'passed', 1);
    expect(mocks.resolveChangeRequestByVoteResult).toHaveBeenCalled();
    const closing = txWith([{ id: 'link-2', change_request_id: null }]);
    await api.markTimelineVoteResult(
      closing as never,
      ctx as never,
      { id: 'vote-2' },
      'rejected',
      1
    );
    expect(closing.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('closes sparse, process-linked, and non-notifying expired votes', async () => {
    const sparse = txWith([[], [], [], [], null]);
    await api.closeExpiredFinalVote(
      sparse as never,
      ctx as never,
      { id: 'vote-1', agenda_item_id: null },
      100
    );
    expect(sparse.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({ closed_reason: 'time_elapsed' })
    );

    await api.closeExpiredFinalVote(
      txWith([null, [], [], [], [], null, null]) as never,
      ctx as never,
      { id: 'vote-unlinked-event', agenda_item_id: 'agenda-missing' },
      100
    );

    mocks.resolveAmendmentProcessVote.mockResolvedValueOnce({
      handled: true,
      branchId: 'branch-1',
    });
    const processVote = txWith([
      null,
      [
        { id: 'accept', label: 'yes', order_index: 0 },
        { id: 'reject', label: 'no', order_index: 1 },
      ],
      [{ choice_id: 'accept' }],
      [],
      [],
      null,
      null,
      [],
      [],
      { event_id: 'event-1', title: null },
    ]);
    await api.closeExpiredFinalVote(
      processVote as never,
      ctx as never,
      {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        title: null,
        purpose: 'merge_variant',
      },
      100
    );
    expect(mocks.materializeCurrentVoting).toHaveBeenCalledWith(processVote, ctx, 'branch-1');
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyVotingCompleted',
      expect.objectContaining({ agendaItemTitle: 'Agenda item' })
    );

    const crVote = txWith([
      { id: 'link-1', is_closing_vote: false },
      [
        { id: 'accept', label: 'yes' },
        { id: 'reject', label: 'no' },
      ],
      [],
      [],
      [],
      { id: 'link-1', change_request_id: null },
      { event_id: 'event-1' },
    ]);
    await api.closeExpiredFinalVote(
      crVote as never,
      ctx as never,
      { id: 'vote-2', agenda_item_id: 'agenda-1', purpose: 'change_request' },
      100
    );
    expect(mocks.resolveAmendmentProcessVote).toHaveBeenCalledTimes(2);
  });
});

describe('vote server public mutator edge branches', () => {
  const idempotencyId = '00000000-0000-4000-8000-000000000001';
  const baseVote = {
    id: 'vote-1',
    agenda_item_id: 'agenda-1',
    status: 'indicative',
    ballot_visibility: 'named',
    electorate_snapshotted_at: null,
  };

  async function submit(rows: unknown[], overrides: Record<string, unknown> = {}) {
    const tx = txWith(rows);
    await voteServerMutators.submitVote.fn({
      tx: tx as never,
      ctx,
      args: {
        vote_id: 'vote-1',
        phase: 'indicative',
        choice_ids: ['choice-1'],
        idempotency_id: idempotencyId,
        ...overrides,
      } as never,
    });
    return tx;
  }

  it('starts votes with optional closing times and rejects missing votes', async () => {
    const updateSpy = vi.spyOn(voteServerMutators.updateVote, 'fn').mockResolvedValue(undefined);
    await expect(
      voteServerMutators.startVote.fn({
        tx: txWith([null]) as never,
        ctx,
        args: { vote_id: 'vote-1', phase: 'indicative' } as never,
      })
    ).rejects.toThrow(/not found/i);
    await voteServerMutators.startVote.fn({
      tx: txWith([{ id: 'vote-1' }]) as never,
      ctx,
      args: { vote_id: 'vote-1', phase: 'indicative' } as never,
    });
    expect(updateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.not.objectContaining({ closing_end_time: expect.anything() }),
      })
    );
    await voteServerMutators.startVote.fn({
      tx: txWith([{ id: 'vote-1' }]) as never,
      ctx,
      args: { vote_id: 'vote-1', phase: 'indicative', closing_end_time: null } as never,
    });
    expect(updateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: expect.objectContaining({ closing_end_time: null }) })
    );
    updateSpy.mockRestore();
  });

  it('validates vote phase and indicative choice identity', async () => {
    await expect(submit([null], { choice_ids: [] })).rejects.toThrow(/not open/i);
    await expect(submit([{ ...baseVote, status: 'final' }])).rejects.toThrow(/not open/i);
    await expect(submit([baseVote, [{ id: 'other' }]])).rejects.toThrow(/choice not found/i);
  });

  it('supports indicative idempotency, named replacement, and secret ballots', async () => {
    mocks.isOwnedTutorial.mockResolvedValueOnce(true);
    await submit([baseVote, [{ id: 'choice-1' }], { id: idempotencyId }]);

    await expect(
      submit([
        { ...baseVote, ballot_visibility: 'secret' },
        [{ id: 'choice-1' }],
        { id: 'existing' },
      ])
    ).rejects.toThrow(/secret indicative/i);

    const replaced = await submit([
      baseVote,
      [{ id: 'choice-1' }],
      { id: 'existing' },
      [{ id: 'old-1' }, { id: 'old-2' }],
    ]);
    expect(replaced.mutate.indicative_choice_decision.delete).toHaveBeenCalledTimes(2);
    expect(replaced.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: 'existing' })
    );

    const freshSecret = await submit([
      { ...baseVote, ballot_visibility: 'secret' },
      [{ id: 'choice-1' }],
      null,
    ]);
    expect(freshSecret.mutate.indicative_voter_participation.insert).toHaveBeenCalled();
    expect(freshSecret.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: null })
    );

    const freshDefaultNamed = await submit([
      { ...baseVote, ballot_visibility: null },
      [{ id: 'choice-1' }],
      null,
    ]);
    expect(freshDefaultNamed.mutate.indicative_choice_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ voter_participation_id: idempotencyId })
    );

    await submit([
      { ...baseVote, ballot_visibility: null },
      [{ id: 'choice-1' }],
      { id: 'existing-default' },
      [],
    ]);
  });

  it('enforces final snapshot membership, channels, choices, and idempotency', async () => {
    await expect(submit([{ ...baseVote, status: 'final' }], { phase: 'final' })).rejects.toThrow(
      /not been snapshotted/i
    );
    const finalVote = { ...baseVote, status: 'final', electorate_snapshotted_at: 1 };
    await expect(submit([finalVote, null], { phase: 'final' })).rejects.toThrow(/not part/i);
    await expect(
      submit([finalVote, { id: 'voter-1', participation_channel: 'offline' }], {
        phase: 'final',
      })
    ).rejects.toThrow(/offline tally flow/i);
    await expect(
      submit([finalVote, { id: 'voter-1', participation_channel: 'online' }, [{ id: 'other' }]], {
        phase: 'final',
      })
    ).rejects.toThrow(/choice not found/i);

    await submit(
      [
        finalVote,
        { id: 'voter-1', participation_channel: 'online' },
        [{ id: 'choice-1' }],
        { id: idempotencyId },
      ],
      { phase: 'final' }
    );
    await expect(
      submit(
        [
          finalVote,
          { id: 'voter-1', participation_channel: 'online' },
          [{ id: 'choice-1' }],
          { id: 'existing' },
        ],
        { phase: 'final' }
      )
    ).rejects.toThrow(/already cast/i);

    await submit(
      [
        { ...finalVote, ballot_visibility: 'secret' },
        { id: 'voter-1', participation_channel: 'online' },
        [{ id: 'choice-1' }],
        null,
        null,
      ],
      { phase: 'final' }
    );
    expect(mocks.castFinalVoteFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          decisions: [expect.objectContaining({ voter_participation_id: null })],
        }),
      })
    );

    await submit(
      [
        finalVote,
        { id: 'voter-1', participation_channel: 'online' },
        [{ id: 'choice-1' }],
        null,
        null,
      ],
      { phase: 'final' }
    );
    expect(mocks.castFinalVoteFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          decisions: [expect.objectContaining({ voter_participation_id: idempotencyId })],
        }),
      })
    );

    await submit(
      [
        { ...finalVote, ballot_visibility: null },
        { id: 'voter-1', participation_channel: 'online' },
        [{ id: 'choice-1' }],
        null,
        null,
      ],
      { phase: 'final' }
    );
    expect(mocks.castFinalVoteFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          decisions: [expect.objectContaining({ voter_participation_id: idempotencyId })],
        }),
      })
    );
  });

  it('creates votes with sparse, missing-event, and linked-event agenda data', async () => {
    await voteServerMutators.createVote.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'vote-1', agenda_item_id: null } as never,
    });
    await voteServerMutators.createVote.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'vote-2', agenda_item_id: 'agenda-1' } as never,
    });
    await voteServerMutators.createVote.fn({
      tx: txWith([{ event_id: 'event-1' }]) as never,
      ctx,
      args: { id: 'vote-3', agenda_item_id: 'agenda-1' } as never,
    });
    expect(mocks.recomputeEventCounters).toHaveBeenCalledWith(expect.anything(), 'event-1');
  });

  it('covers sparse updates and starts a real closing vote with title fallbacks', async () => {
    await voteServerMutators.updateVote.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'vote-1' } as never,
    });

    const tx = txWith([
      {
        id: 'vote-1',
        status: 'indicative',
        agenda_item_id: 'agenda-1',
        amendment_id: null,
        purpose: 'closing',
        title: null,
      },
      null,
      [],
      null,
      [],
      [],
      null,
      [],
      [],
      { event_id: 'event-1', title: null },
    ]);
    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx,
      args: { id: 'vote-1', status: 'final', closing_end_time: null } as never,
    });
    expect(mocks.snapshotElectorate).toHaveBeenCalledWith(tx, 'vote-1');
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyVotingPhaseStarted',
      expect.objectContaining({ agendaItemTitle: 'Agenda item' })
    );

    const titled = txWith([
      { id: 'vote-2', status: 'indicative', agenda_item_id: 'agenda-2', title: 'Vote title' },
      null,
      [],
      null,
      [],
      [],
      { event_id: 'event-2', title: null },
    ]);
    await voteServerMutators.updateVote.fn({
      tx: titled as never,
      ctx,
      args: { id: 'vote-2', status: 'final', closing_end_time: null } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyVotingPhaseStarted',
      expect.objectContaining({ agendaItemTitle: 'Vote title' })
    );
  });

  it('skips nonfinal and future final expirations', async () => {
    await voteServerMutators.closeExpiredFinalVotesForEvent.fn({
      tx: txWith([
        [{ id: 'agenda-1' }],
        [
          { id: 'indicative', status: 'indicative' },
          { id: 'untimed', status: 'final', closing_end_time: null },
          { id: 'future', status: 'final', closing_end_time: Date.now() + 60_000 },
        ],
      ]) as never,
      ctx,
      args: { event_id: 'event-1' },
    });
    expect(mocks.recomputeEventCounters).toHaveBeenCalledWith(expect.anything(), 'event-1');
  });

  it('executes direct vote wrappers and only auto-closes final offline tally updates', async () => {
    for (const [name, args] of [
      ['castIndicativeVote', { vote_id: 'vote-1' }],
      ['replaceIndicativeVote', { participation: { vote_id: 'vote-1' } }],
      ['castFinalVote', { vote_id: 'vote-1' }],
      ['castFinalVoteFull', { participation: { vote_id: 'vote-1' } }],
    ] as const) {
      await voteServerMutators[name].fn({ tx: txWith([null]) as never, ctx, args: args as never });
    }
    expect(mocks.castIndicativeVote).toHaveBeenCalled();
    expect(mocks.replaceIndicativeVote).toHaveBeenCalled();
    expect(mocks.castFinalVote).toHaveBeenCalled();
    expect(mocks.castFinalVoteFull).toHaveBeenCalled();

    await voteServerMutators.upsertOfflineTally.fn({
      tx: txWith([
        { agenda_item_id: 'agenda-1' },
        { event_id: 'event-1' },
        { offline_electorate_size: 1 },
        [],
      ]) as never,
      ctx,
      args: { vote_id: 'vote-1', phase: 'indicative', choice_id: 'choice-1', count: 1 },
    });
    expect(mocks.upsertOfflineTally).toHaveBeenCalled();
  });
});
