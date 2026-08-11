/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  castFinalVote: vi.fn(),
  castIndicativeVote: vi.fn(),
  createVoter: vi.fn(),
  processCRVoteResult: vi.fn(),
  toastError: vi.fn(),
  updateAgendaItemChangeRequest: vi.fn(),
  updateVote: vi.fn(),
  useAgendaItemCRTimeline: vi.fn(),
}));

vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaItemCRTimeline: (...args: unknown[]) => mocks.useAgendaItemCRTimeline(...args),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    updateAgendaItemChangeRequest: mocks.updateAgendaItemChangeRequest,
    processCRVoteResult: mocks.processCRVoteResult,
  }),
}));

vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    updateVote: mocks.updateVote,
    castIndicativeVote: mocks.castIndicativeVote,
    castFinalVote: mocks.castFinalVote,
    createVoter: mocks.createVoter,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : _key,
}));

import { getVotePhase, getVoteResult, useAgendaItemCRVoting } from '../useAgendaItemCRVoting';

function setDefaultTimeline() {
  mocks.useAgendaItemCRTimeline.mockReturnValue({
    crTimeline: [],
    currentItem: null,
    pendingItems: [],
    completedItems: [],
    closingVoteItem: null,
    progress: 0,
    isLoading: false,
  });
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  const mutationResult = {
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  };
  mocks.updateVote.mockReturnValue(mutationResult);
  mocks.updateAgendaItemChangeRequest.mockReturnValue(mutationResult);
  mocks.castIndicativeVote.mockReturnValue(mutationResult);
  mocks.castFinalVote.mockReturnValue(mutationResult);
  setDefaultTimeline();
});

afterEach(() => {
  cleanup();
});

describe('getVoteResult', () => {
  it('handles missing votes, empty choices, nullable fields, and explicit offline electorates', () => {
    expect(getVoteResult({ vote: null } as never)).toBe('tie');
    expect(getVoteResult({ vote: { choices: [] } } as never)).toBe('tie');
    expect(getVoteResult({ vote: {} } as never)).toBe('tie');
    expect(
      getVoteResult({
        vote: {
          choices: [{ id: 'yes', label: 'yes', order_index: 0 }],
          final_decisions: [],
          offline_tallies: [],
          offline_electorate_size: null,
        },
      } as never)
    ).toBe('tie');
    expect(
      getVoteResult({
        vote: {
          choices: [{ id: 'yes', label: 'yes', order_index: 0 }],
          final_decisions: [],
          offline_tallies: [],
          offline_electorate_size: 0,
        },
      } as never)
    ).toBe('tie');

    const item = {
      vote: {
        status: 'closed',
        majority_type: 'legacy',
        offline_electorate_size: 2,
        voters: [
          { id: 'online', participation_channel: 'online' },
          { id: 'offline', participation_channel: 'offline' },
        ],
        choices: [
          { id: 'yes', label: null, order_index: null },
          { id: 'no', label: 'No', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: null, choice: { id: 'yes' } },
          { choice_id: null, choice: null },
        ],
        offline_tallies: [
          { phase: 'indicative', choice_id: 'yes', count: 9 },
          { phase: 'final', choice_id: 'yes', count: null },
        ],
      },
    };
    expect(getVotePhase(item as never)).toBe('closed');
    expect(getVoteResult(item as never)).toBe('passed');
  });

  it('treats accept/reject labels as decisive choices instead of reporting a tie', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'simple',
        voters: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
        choices: [
          { id: 'abstain', label: 'abstain', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'accept', label: 'accept', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'accept' },
          { choice_id: 'accept' },
          { choice_id: 'reject' },
        ],
      },
    } as never);

    expect(result).toBe('passed');
  });

  it('respects majority thresholds when resolving closed CR votes', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'two_thirds',
        voters: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }],
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'accept' },
          { choice_id: 'accept' },
          { choice_id: 'reject' },
        ],
      },
    } as never);

    expect(result).toBe('rejected');
  });

  it('includes final offline tallies when resolving a closed CR vote', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'simple',
        voters: [],
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        final_decisions: [],
        offline_tallies: [{ choice_id: 'accept', phase: 'final', count: 1 }],
      },
    } as never);

    expect(result).toBe('passed');
  });
});

describe('useAgendaItemCRVoting', () => {
  it('derives user voting state and selected choices across phases', () => {
    const indicative = {
      id: 'indicative',
      status: 'voting',
      vote: {
        id: 'vote-i',
        status: 'indicative',
        voters: null,
        indicative_participations: [
          {
            user_id: 'user-1',
            decisions: [
              { choice: { id: 'choice-object' } },
              { choice_id: 'choice-id' },
              { choice_id: null },
            ],
          },
        ],
      },
    };
    const final = {
      id: 'final',
      status: 'voting',
      vote: {
        id: 'vote-f',
        status: 'final',
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        final_participations: [{ voter_id: 'voter-1', decisions: [{ choice_id: 'choice-final' }] }],
      },
    };
    const closedNoVoter = {
      id: 'closed',
      status: 'completed',
      vote: { id: 'vote-c', status: 'closed', voters: [], final_participations: [] },
    };
    mocks.useAgendaItemCRTimeline.mockReturnValue({
      crTimeline: [indicative, final, closedNoVoter],
      currentItem: indicative,
      pendingItems: [],
      completedItems: [],
      closingVoteItem: null,
      progress: 25,
      isLoading: false,
    });

    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));
    expect(result.current.hasUserVoted(indicative as never)).toBe(true);
    expect(result.current.hasUserVoted(final as never)).toBe(true);
    expect(result.current.hasUserVoted(closedNoVoter as never)).toBe(false);
    expect(result.current.hasUserVoted({ vote: null } as never)).toBe(false);
    expect(result.current.getUserVoter(final as never)).toEqual(
      expect.objectContaining({ id: 'voter-1' })
    );
    expect(result.current.getUserVoter(indicative as never)).toBeNull();
    expect(result.current.getUserSelectedChoiceIds(indicative as never)).toEqual([
      'choice-object',
      'choice-id',
    ]);
    expect(result.current.getUserSelectedChoiceIds(final as never)).toEqual(['choice-final']);
    expect(result.current.getUserSelectedChoiceIds(closedNoVoter as never)).toEqual([]);
    expect(result.current.getUserSelectedChoiceIds({ vote: null } as never)).toEqual([]);
    const finalWithoutCollections = {
      vote: {
        id: 'vote-empty-final',
        status: 'final',
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
      },
    };
    const indicativeWithoutCollections = {
      vote: { id: 'vote-empty-indicative', status: 'indicative' },
    };
    const participationWithoutDecisions = {
      vote: {
        id: 'vote-no-decisions',
        status: 'indicative',
        indicative_participations: [{ user_id: 'user-1' }],
      },
    };
    expect(
      result.current.hasUserVoted({
        vote: { id: 'vote-no-voters', status: 'final' },
      } as never)
    ).toBe(false);
    expect(result.current.hasUserVoted(finalWithoutCollections as never)).toBe(false);
    expect(result.current.hasUserVoted(indicativeWithoutCollections as never)).toBe(false);
    expect(result.current.getUserSelectedChoiceIds(finalWithoutCollections as never)).toEqual([]);
    expect(result.current.getUserSelectedChoiceIds(indicativeWithoutCollections as never)).toEqual(
      []
    );
    expect(result.current.getUserSelectedChoiceIds(participationWithoutDecisions as never)).toEqual(
      []
    );

    const guest = renderHook(() => useAgendaItemCRVoting('agenda-1'));
    expect(guest.result.current.hasUserVoted(indicative as never)).toBe(false);
    expect(guest.result.current.getUserVoter(final as never)).toBeNull();
    expect(guest.result.current.getUserSelectedChoiceIds(final as never)).toEqual([]);
  });

  it('starts, advances, and closes only real timeline votes', async () => {
    const pending = {
      id: 'pending',
      status: 'pending',
      vote: { id: 'vote-pending', status: 'pending', choices: [] },
    };
    const voting = {
      id: 'voting',
      status: 'voting',
      vote: { id: 'vote-voting', status: 'indicative', choices: [] },
    };
    const missingVote = { id: 'missing', status: 'pending', vote: null };
    mocks.useAgendaItemCRTimeline.mockReturnValue({
      crTimeline: [pending, voting, missingVote],
      currentItem: pending,
      pendingItems: [pending],
      completedItems: [],
      closingVoteItem: null,
      progress: 0,
      isLoading: false,
    });
    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));

    await act(async () => {
      await result.current.startIndicativePhase('missing');
      await result.current.startIndicativePhase('absent');
      await result.current.startIndicativePhase('pending');
      await result.current.startFinalPhase('missing');
      await result.current.startFinalPhase('pending');
      await result.current.startFinalPhase('voting');
      await result.current.closeVoting('missing');
      await result.current.closeVoting('voting');
    });
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-pending', status: 'indicative' });
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-pending', status: 'final' });
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-voting', status: 'final' });
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-voting', status: 'closed' });
    expect(mocks.updateAgendaItemChangeRequest).toHaveBeenCalledWith({
      id: 'pending',
      status: 'voting',
    });
  });

  it('rejects mock and incomplete casts and submits named and secret indicative ballots', async () => {
    const named = {
      id: 'named',
      status: 'voting',
      vote: {
        id: 'vote-named',
        status: 'indicative',
        ballot_visibility: 'named',
        voters: [],
        indicative_participations: [],
      },
    };
    const secret = {
      id: 'secret',
      status: 'voting',
      vote: {
        id: 'vote-secret',
        status: 'indicative',
        ballot_visibility: 'secret',
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        indicative_participations: [],
      },
    };
    const closed = { ...named, id: 'closed', vote: { ...named.vote, status: 'closed' } };
    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));

    await act(async () => {
      await result.current.castCRVote(
        {
          id: 'mock-cr-placeholder',
          vote: named.vote,
        } as never,
        'yes'
      );
      await result.current.castCRVote({ id: 'no-vote', vote: null } as never, 'yes');
      await result.current.castCRVote(closed as never, 'yes');
      await result.current.castCRVote(named as never, 'yes');
      await result.current.castCRVote(secret as never, 'no');
    });
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
    expect(mocks.castIndicativeVote).toHaveBeenCalledTimes(2);
    expect(mocks.castIndicativeVote.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ voter_id: 'snapshot-resolved:user-1' })
    );
    expect(mocks.castIndicativeVote.mock.calls[0]?.[1]?.[0]).toEqual(
      expect.objectContaining({ voter_participation_id: expect.any(String) })
    );
    expect(mocks.castIndicativeVote.mock.calls[1]?.[1]?.[0]).toEqual(
      expect.objectContaining({ voter_participation_id: null })
    );

    const guest = renderHook(() => useAgendaItemCRVoting('agenda-1'));
    await act(async () => guest.result.current.castCRVote(named as never, 'yes'));
    expect(mocks.toastError).toHaveBeenCalledTimes(3);
  });

  it('reports timeline completion for empty, partial, and fully completed sequences', () => {
    mocks.useAgendaItemCRTimeline.mockReturnValue({
      crTimeline: [
        { id: 'cr', is_closing_vote: false, status: 'completed', vote: null },
        { id: 'merge', step_kind: 'merge_variant', status: 'pending', vote: null },
        { id: 'closing', is_closing_vote: true, status: 'completed', vote: null },
      ],
      currentItem: null,
      pendingItems: [],
      completedItems: [],
      closingVoteItem: null,
      progress: 50,
      isLoading: false,
    });
    const partial = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));
    expect(partial.result.current.allCRsProcessed).toBe(true);
    expect(partial.result.current.isTimelineComplete).toBe(false);

    mocks.useAgendaItemCRTimeline.mockReturnValue({
      crTimeline: [{ id: 'cr', status: 'completed', vote: null }],
      currentItem: null,
      pendingItems: [],
      completedItems: [],
      closingVoteItem: null,
      progress: 100,
      isLoading: false,
    });
    const complete = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));
    expect(complete.result.current.allCRsProcessed).toBe(true);
    expect(complete.result.current.isTimelineComplete).toBe(true);

    setDefaultTimeline();
    const empty = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));
    expect(empty.result.current.isTimelineComplete).toBe(false);
  });

  it('closes CR voting through updateVote without processing the CR result on the client', async () => {
    const item = {
      id: 'agenda-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      vote_id: 'vote-1',
      is_closing_vote: false,
      status: 'voting',
      vote: {
        id: 'vote-1',
        status: 'final',
        majority_type: 'simple',
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        final_decisions: [{ choice_id: 'accept' }],
        offline_tallies: [],
      },
    };
    mocks.useAgendaItemCRTimeline.mockReturnValue({
      crTimeline: [item],
      currentItem: item,
      pendingItems: [],
      completedItems: [],
      closingVoteItem: null,
      progress: 0,
      isLoading: false,
    });

    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));
    let voteResult: unknown;

    await act(async () => {
      voteResult = await result.current.closeVoting('agenda-cr-1');
    });

    expect(voteResult).toBe('passed');
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-1', status: 'closed' });
    expect(mocks.processCRVoteResult).not.toHaveBeenCalled();
  });

  it('does not create participation records when a stale dialog submits a closed CR vote', async () => {
    const item = {
      id: 'agenda-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      vote_id: 'vote-1',
      is_closing_vote: false,
      status: 'completed',
      vote: {
        id: 'vote-1',
        status: 'closed',
        ballot_visibility: 'named',
        choices: [{ id: 'choice-yes', label: 'yes', order_index: 0 }],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        indicative_participations: [],
        final_participations: [],
      },
    };

    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));

    await act(async () => {
      await result.current.castCRVote(item as never, 'choice-yes');
    });

    expect(mocks.createVoter).not.toHaveBeenCalled();
    expect(mocks.castIndicativeVote).not.toHaveBeenCalled();
    expect(mocks.castFinalVote).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('awaits the dialog server tracker and silences the action-level final vote toast', async () => {
    const item = {
      id: 'agenda-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      vote_id: 'vote-1',
      is_closing_vote: false,
      status: 'voting',
      vote: {
        id: 'vote-1',
        status: 'final',
        ballot_visibility: 'named',
        choices: [{ id: 'choice-yes', label: 'yes', order_index: 0 }],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        indicative_participations: [],
        final_participations: [],
      },
    };
    const trackServerResult = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));

    await act(async () => {
      await result.current.castCRVote(item as never, 'choice-yes', {
        reportProgress: vi.fn(),
        trackServerResult,
      });
    });

    expect(mocks.castFinalVote).toHaveBeenCalledWith(expect.any(Object), expect.any(Array), {
      silent: true,
    });
    expect(trackServerResult).toHaveBeenCalledWith(mocks.castFinalVote.mock.results[0]?.value);
  });
});
