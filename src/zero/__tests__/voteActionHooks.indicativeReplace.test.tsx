// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const token = (key: string, args: unknown) => ({ key, args });

  return {
    token,
    zeroMutate: vi.fn(),
    onServerError: vi.fn(),
    trackServerFinalization: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    t: vi.fn((key: string) => key),
    voteMutators: {
      submitVote: vi.fn((args: unknown) => token('mutators.votes.submitVote', args)),
      replaceIndicativeVote: vi.fn((args: unknown) =>
        token('mutators.votes.replaceIndicativeVote', args)
      ),
      castIndicativeVote: vi.fn((args: unknown) =>
        token('mutators.votes.castIndicativeVote', args)
      ),
      createIndicativeChoiceDecision: vi.fn((args: unknown) =>
        token('mutators.votes.createIndicativeChoiceDecision', args)
      ),
      castFinalVote: vi.fn((args: unknown) => token('mutators.votes.castFinalVote', args)),
      castFinalVoteFull: vi.fn((args: unknown) => token('mutators.votes.castFinalVoteFull', args)),
      createFinalChoiceDecision: vi.fn((args: unknown) =>
        token('mutators.votes.createFinalChoiceDecision', args)
      ),
    },
    electionMutators: {
      submitElectionVote: vi.fn((args: unknown) =>
        token('mutators.elections.submitElectionVote', args)
      ),
      replaceIndicativeElectionVote: vi.fn((args: unknown) =>
        token('mutators.elections.replaceIndicativeElectionVote', args)
      ),
      castIndicativeElectionVote: vi.fn((args: unknown) =>
        token('mutators.elections.castIndicativeElectionVote', args)
      ),
      createIndicativeCandidateSelection: vi.fn((args: unknown) =>
        token('mutators.elections.createIndicativeCandidateSelection', args)
      ),
      castFinalElectionVote: vi.fn((args: unknown) =>
        token('mutators.elections.castFinalElectionVote', args)
      ),
      castFinalElectionVoteFull: vi.fn((args: unknown) =>
        token('mutators.elections.castFinalElectionVoteFull', args)
      ),
      createFinalCandidateSelection: vi.fn((args: unknown) =>
        token('mutators.elections.createFinalCandidateSelection', args)
      ),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({
    mutate: mocks.zeroMutate,
  }),
}));

vi.mock('../mutators', () => ({
  mutators: {
    votes: mocks.voteMutators,
    elections: mocks.electionMutators,
  },
}));

vi.mock('../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => mocks.onServerError(...args),
  trackServerFinalization: (...args: unknown[]) => mocks.trackServerFinalization(...args),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: mocks.t }),
}));

import { useElectionActions } from '../elections/useElectionActions';
import { useVoteActions } from '../votes/useVoteActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.zeroMutate.mockReturnValue({
    server: Promise.resolve({ type: 'success' }),
  });
});

describe('vote action hooks route indicative replacement', () => {
  it('routes indicative vote submissions through the composite replace mutator', async () => {
    const participation = { id: 'participation-1', vote_id: 'vote-1', voter_id: 'voter-1' };
    const decisions = [
      {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'participation-1',
      },
    ];
    const { result } = renderHook(() => useVoteActions());

    await act(async () => {
      await result.current.castIndicativeVote(participation, decisions);
    });

    expect(mocks.voteMutators.submitVote).toHaveBeenCalledWith({
      vote_id: 'vote-1',
      phase: 'indicative',
      choice_ids: ['choice-1'],
      idempotency_id: 'participation-1',
    });
    expect(mocks.voteMutators.castIndicativeVote).not.toHaveBeenCalled();
    expect(mocks.voteMutators.createIndicativeChoiceDecision).not.toHaveBeenCalled();
  });

  it('routes final vote submissions through the composite final mutator', async () => {
    const participation = { id: 'final-1', vote_id: 'vote-1', voter_id: 'voter-1' };
    const decisions = [
      {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'final-1',
      },
    ];
    const { result } = renderHook(() => useVoteActions());

    await act(async () => {
      await result.current.castFinalVote(participation, decisions);
    });

    expect(mocks.voteMutators.submitVote).toHaveBeenCalledWith({
      vote_id: 'vote-1',
      phase: 'final',
      choice_ids: ['choice-1'],
      idempotency_id: 'final-1',
    });
    expect(mocks.voteMutators.castFinalVote).not.toHaveBeenCalled();
    expect(mocks.voteMutators.createFinalChoiceDecision).not.toHaveBeenCalled();
    expect(mocks.voteMutators.replaceIndicativeVote).not.toHaveBeenCalled();
  });

  it('routes indicative election submissions through the composite replace mutator', async () => {
    const participation = {
      id: 'participation-1',
      election_id: 'election-1',
      elector_id: 'elector-1',
    };
    const selections = [
      {
        id: 'selection-1',
        election_id: 'election-1',
        candidate_id: 'candidate-1',
        elector_participation_id: 'participation-1',
      },
    ];
    const { result } = renderHook(() => useElectionActions());

    await act(async () => {
      await result.current.castIndicativeVote(participation, selections);
    });

    expect(mocks.electionMutators.submitElectionVote).toHaveBeenCalledWith({
      election_id: 'election-1',
      phase: 'indicative',
      candidate_ids: ['candidate-1'],
      idempotency_id: 'participation-1',
    });
    expect(mocks.electionMutators.castIndicativeElectionVote).not.toHaveBeenCalled();
    expect(mocks.electionMutators.createIndicativeCandidateSelection).not.toHaveBeenCalled();
  });

  it('routes final election submissions through the composite final mutator', async () => {
    const participation = { id: 'final-1', election_id: 'election-1', elector_id: 'elector-1' };
    const selections = [
      {
        id: 'selection-1',
        election_id: 'election-1',
        candidate_id: 'candidate-1',
        elector_participation_id: 'final-1',
      },
    ];
    const { result } = renderHook(() => useElectionActions());

    await act(async () => {
      await result.current.castFinalVote(participation, selections);
    });

    expect(mocks.electionMutators.submitElectionVote).toHaveBeenCalledWith({
      election_id: 'election-1',
      phase: 'final',
      candidate_ids: ['candidate-1'],
      idempotency_id: 'final-1',
    });
    expect(mocks.electionMutators.castFinalElectionVote).not.toHaveBeenCalled();
    expect(mocks.electionMutators.createFinalCandidateSelection).not.toHaveBeenCalled();
    expect(mocks.electionMutators.replaceIndicativeElectionVote).not.toHaveBeenCalled();
  });

  it('uses one stable toast id for server-confirmed vote and election success messages', async () => {
    const voteParticipation = {
      id: 'vote-participation',
      vote_id: 'vote-1',
      voter_id: 'voter-1',
    };
    const voteDecisions = [
      {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'vote-participation',
      },
    ];
    const electionParticipation = {
      id: 'election-participation',
      election_id: 'election-1',
      elector_id: 'elector-1',
    };
    const electionSelections = [
      {
        id: 'selection-1',
        election_id: 'election-1',
        candidate_id: 'candidate-1',
        elector_participation_id: 'election-participation',
      },
    ];
    const voteActions = renderHook(() => useVoteActions());
    const electionActions = renderHook(() => useElectionActions());

    act(() => {
      voteActions.result.current.castIndicativeVote(voteParticipation, voteDecisions);
      electionActions.result.current.castIndicativeVote(electionParticipation, electionSelections);
    });

    for (const [, callbacks] of mocks.trackServerFinalization.mock.calls) {
      callbacks.onSuccess();
    }

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenNthCalledWith(1, 'common.agendaToasts.voteCast', {
      id: 'vote-cast-success',
    });
    expect(mocks.toastSuccess).toHaveBeenNthCalledWith(2, 'common.agendaToasts.voteCast', {
      id: 'vote-cast-success',
    });
  });
});
