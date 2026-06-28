/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useVoteCasting } from '../useVoteCasting';
import type { VoteSubmissionContext } from '@/features/shared/ui/voting';

const mocks = vi.hoisted(() => ({
  electionActions: {
    createElector: vi.fn(),
    castIndicativeVote: vi.fn(),
    castFinalVote: vi.fn(),
    updateElection: vi.fn(),
  },
  voteActions: {
    createVoter: vi.fn(),
    castIndicativeVote: vi.fn(),
    castFinalVote: vi.fn(),
    updateVote: vi.fn(),
  },
  can: vi.fn(),
}));

function mutationResult() {
  return {
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' as const }),
  };
}

vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => mocks.electionActions,
}));

vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => mocks.voteActions,
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: mocks.can }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

function createProgressRecorder() {
  const progress: string[] = [];
  const context: VoteSubmissionContext = {
    reportProgress: (stepKey, status) => {
      progress.push(`${stepKey}:${status}`);
    },
  };

  return { context, progress };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockReturnValue(true);
  mocks.electionActions.castIndicativeVote.mockReturnValue(mutationResult());
  mocks.electionActions.castFinalVote.mockReturnValue(mutationResult());
  mocks.voteActions.castIndicativeVote.mockReturnValue(mutationResult());
  mocks.voteActions.castFinalVote.mockReturnValue(mutationResult());
});

describe('useVoteCasting submission progress', () => {
  it('reports election cast and sync progress around the final election action', async () => {
    const { context, progress } = createProgressRecorder();
    const { result } = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        electionId: 'election-1',
        eventId: 'event-1',
        status: 'final',
        electorId: 'elector-1',
      })
    );

    await act(async () => {
      await result.current.castElectionVote(['candidate-1'], context);
    });

    expect(progress).toEqual(['cast:active', 'cast:complete', 'sync:active', 'sync:complete']);
    expect(mocks.electionActions.castFinalVote).toHaveBeenCalledTimes(1);
    expect(mocks.electionActions.castFinalVote).toHaveBeenCalledWith(
      expect.objectContaining({ elector_id: 'elector-1' }),
      expect.any(Array),
      { elector: undefined, silent: true }
    );
    expect(mocks.electionActions.castIndicativeVote).not.toHaveBeenCalled();
  });

  it('reports amendment vote cast and sync progress around the indicative vote action', async () => {
    const { context, progress } = createProgressRecorder();
    const { result } = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        voteId: 'vote-1',
        eventId: 'event-1',
        status: 'indication',
        voterId: 'voter-1',
      })
    );

    await act(async () => {
      await result.current.castAmendmentVote('choice-1', context);
    });

    expect(progress).toEqual(['cast:active', 'cast:complete', 'sync:active', 'sync:complete']);
    expect(mocks.voteActions.castIndicativeVote).toHaveBeenCalledTimes(1);
    expect(mocks.voteActions.castIndicativeVote).toHaveBeenCalledWith(
      expect.objectContaining({ voter_id: 'voter-1' }),
      expect.any(Array),
      { silent: true, voter: undefined }
    );
    expect(mocks.voteActions.castFinalVote).not.toHaveBeenCalled();
  });

  it('creates a missing elector inside the full election vote mutation', async () => {
    const { context } = createProgressRecorder();
    const { result } = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        electionId: 'election-1',
        eventId: 'event-1',
        status: 'final',
      })
    );

    await act(async () => {
      await result.current.castElectionVote(['candidate-1'], context);
    });

    expect(mocks.electionActions.createElector).not.toHaveBeenCalled();
    expect(mocks.electionActions.castFinalVote).toHaveBeenCalledWith(
      expect.objectContaining({ elector_id: expect.any(String) }),
      expect.any(Array),
      {
        elector: expect.objectContaining({
          election_id: 'election-1',
          user_id: 'user-1',
        }),
        silent: true,
      }
    );
  });

  it('creates a missing voter inside the full amendment vote mutation', async () => {
    const { context } = createProgressRecorder();
    const { result } = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        voteId: 'vote-1',
        eventId: 'event-1',
        status: 'indication',
      })
    );

    await act(async () => {
      await result.current.castAmendmentVote('choice-1', context);
    });

    expect(mocks.voteActions.createVoter).not.toHaveBeenCalled();
    expect(mocks.voteActions.castIndicativeVote).toHaveBeenCalledWith(
      expect.objectContaining({ voter_id: expect.any(String) }),
      expect.any(Array),
      {
        silent: true,
        voter: expect.objectContaining({
          vote_id: 'vote-1',
          user_id: 'user-1',
        }),
      }
    );
  });
});
