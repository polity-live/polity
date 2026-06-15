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
  mocks.electionActions.castIndicativeVote.mockResolvedValue(undefined);
  mocks.electionActions.castFinalVote.mockResolvedValue(undefined);
  mocks.voteActions.castIndicativeVote.mockResolvedValue(undefined);
  mocks.voteActions.castFinalVote.mockResolvedValue(undefined);
});

describe('useVoteCasting submission progress', () => {
  it('reports election cast and sync progress around the final election action', async () => {
    const { context, progress } = createProgressRecorder();
    const { result } = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        electionId: 'election-1',
        eventId: 'event-1',
        status: 'final_vote',
        electorId: 'elector-1',
      })
    );

    await act(async () => {
      await result.current.castElectionVote(['candidate-1'], context);
    });

    expect(progress).toEqual(['cast:active', 'cast:complete', 'sync:active', 'sync:complete']);
    expect(mocks.electionActions.castFinalVote).toHaveBeenCalledTimes(1);
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
    expect(mocks.voteActions.castFinalVote).not.toHaveBeenCalled();
  });
});
