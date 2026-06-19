// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const token = (key: string, args: unknown) => ({ key, args });

  return {
    token,
    zeroMutate: vi.fn(),
    onServerError: vi.fn(),
    serverConfirmed: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    t: vi.fn((key: string) => key),
    voteMutators: {
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
      createFinalChoiceDecision: vi.fn((args: unknown) =>
        token('mutators.votes.createFinalChoiceDecision', args)
      ),
    },
    electionMutators: {
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
  serverConfirmed: (...args: unknown[]) => mocks.serverConfirmed(...args),
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

    expect(mocks.voteMutators.replaceIndicativeVote).toHaveBeenCalledWith({
      participation,
      decisions,
    });
    expect(mocks.voteMutators.castIndicativeVote).not.toHaveBeenCalled();
    expect(mocks.voteMutators.createIndicativeChoiceDecision).not.toHaveBeenCalled();
  });

  it('keeps final vote submissions on the insert-only final mutators', async () => {
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

    expect(mocks.voteMutators.castFinalVote).toHaveBeenCalledWith(participation);
    expect(mocks.voteMutators.createFinalChoiceDecision).toHaveBeenCalledWith(decisions[0]);
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

    expect(mocks.electionMutators.replaceIndicativeElectionVote).toHaveBeenCalledWith({
      participation,
      selections,
    });
    expect(mocks.electionMutators.castIndicativeElectionVote).not.toHaveBeenCalled();
    expect(mocks.electionMutators.createIndicativeCandidateSelection).not.toHaveBeenCalled();
  });

  it('keeps final election submissions on the insert-only final mutators', async () => {
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

    expect(mocks.electionMutators.castFinalElectionVote).toHaveBeenCalledWith(participation);
    expect(mocks.electionMutators.createFinalCandidateSelection).toHaveBeenCalledWith(
      selections[0]
    );
    expect(mocks.electionMutators.replaceIndicativeElectionVote).not.toHaveBeenCalled();
  });
});
