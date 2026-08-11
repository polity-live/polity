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
  authUser: { id: 'user-1' } as { id: string } | null,
  waitForClientApply: vi.fn(async (value: unknown) => value),
  trackServerFinalization: vi.fn(),
  tutorial: vi.fn(),
  toastError: vi.fn(),
  localize: vi.fn(() => 'localized error'),
  logError: vi.fn(),
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
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
  trackServerFinalization: mocks.trackServerFinalization,
}));
vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.tutorial,
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError },
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: mocks.localize,
}));
vi.mock('@/features/elections/logic/electionFlowLogging', () => ({
  createElectionFlowCorrelationId: (kind: string) => `correlation-${kind}`,
  logElectionFlowClient: vi.fn(),
  logElectionFlowClientError: mocks.logError,
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
  mocks.authUser = { id: 'user-1' };
  mocks.can.mockReturnValue(true);
  mocks.waitForClientApply.mockImplementation(async value => value);
  mocks.localize.mockReturnValue('localized error');
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

  it('derives every phase and permission summary', () => {
    const statuses = [
      ['internal', 'internal'],
      ['final', 'final'],
      ['closed', 'closed'],
      ['completed', 'closed'],
      ['pending', 'indication'],
      [null, 'indication'],
    ] as const;
    const { result, rerender } = renderHook(
      ({ status }) => useVoteCasting({ agendaItemId: 'agenda-1', status }),
      { initialProps: { status: statuses[0][0] as string | null } }
    );
    for (const [status, phase] of statuses) {
      rerender({ status });
      expect(result.current.phase).toBe(phase);
    }
    mocks.can.mockReturnValue(false);
    rerender({ status: 'final' });
    expect(result.current).toEqual(
      expect.objectContaining({
        userCanVote: false,
        userCanBeCandidate: false,
        canManageVoting: false,
      })
    );
  });

  it('silently rejects missing identity, permission, or ballot identifiers', async () => {
    mocks.authUser = null;
    const anonymous = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', electionId: 'election-1', voteId: 'vote-1' })
    );
    await act(() => anonymous.result.current.castElectionVote(['candidate-1']));
    await act(() => anonymous.result.current.castAmendmentVote('choice-1'));

    mocks.authUser = { id: 'user-1' };
    mocks.can.mockReturnValue(false);
    const denied = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', electionId: 'election-1', voteId: 'vote-1' })
    );
    await act(() => denied.result.current.castElectionVote(['candidate-1']));
    await act(() => denied.result.current.castAmendmentVote('choice-1'));

    mocks.can.mockReturnValue(true);
    const missingIds = renderHook(() => useVoteCasting({ agendaItemId: 'agenda-1' }));
    await act(() => missingIds.result.current.castElectionVote(['candidate-1']));
    await act(() => missingIds.result.current.castAmendmentVote('choice-1'));
    expect(mocks.electionActions.castIndicativeVote).not.toHaveBeenCalled();
    expect(mocks.voteActions.castIndicativeVote).not.toHaveBeenCalled();
  });

  it('records named participation and tracks server-confirmed election and vote mutations', async () => {
    const trackServerResult = vi.fn().mockResolvedValue(undefined);
    const context = { ...createProgressRecorder().context, trackServerResult };
    const election = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        electionId: 'election-1',
        status: 'internal',
        ballotVisibility: 'named',
      })
    );
    await act(() => election.result.current.castElectionVote(['a', 'b'], context));
    const electionArgs = mocks.electionActions.castIndicativeVote.mock.calls[0];
    expect(electionArgs[1]).toHaveLength(2);
    expect(electionArgs[1][0].elector_participation_id).toBe(electionArgs[0].id);

    const vote = renderHook(() =>
      useVoteCasting({
        agendaItemId: 'agenda-1',
        voteId: 'vote-1',
        status: 'final',
        ballotVisibility: 'named',
      })
    );
    await act(() => vote.result.current.castAmendmentVote('choice-1', context));
    const voteArgs = mocks.voteActions.castFinalVote.mock.calls[0];
    expect(voteArgs[1][0].voter_participation_id).toBe(voteArgs[0].id);
    expect(trackServerResult).toHaveBeenCalledTimes(2);
    expect(mocks.tutorial).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'agenda-election.voted',
    });
    expect(mocks.tutorial).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'agenda-amendment.voted',
    });
  });

  it('tracks background finalization success and localized failure callbacks', async () => {
    const election = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', electionId: 'election-1', status: 'final' })
    );
    await act(() => election.result.current.castElectionVote(['candidate-1']));
    const electionOptions = mocks.trackServerFinalization.mock.calls[0][1];
    electionOptions.onSuccess();
    electionOptions.onError(new Error('server election'));

    const vote = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', voteId: 'vote-1', status: 'final' })
    );
    await act(() => vote.result.current.castAmendmentVote('choice-1'));
    const voteOptions = mocks.trackServerFinalization.mock.calls[1][1];
    voteOptions.onSuccess();
    voteOptions.onError(new Error('server vote'));
    expect(mocks.tutorial).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });

  it('reports and rethrows election and amendment failures for Error and non-Error values', async () => {
    const electionFailure = new Error('election failed');
    mocks.waitForClientApply.mockRejectedValueOnce(electionFailure);
    const electionProgress = createProgressRecorder();
    const election = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', electionId: 'election-1', status: 'final' })
    );
    await expect(
      act(() => election.result.current.castElectionVote(['candidate-1'], electionProgress.context))
    ).rejects.toBe(electionFailure);
    expect(electionProgress.progress).toContain('sync:error');

    mocks.waitForClientApply.mockRejectedValueOnce('vote failed');
    const vote = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', voteId: 'vote-1', status: 'final' })
    );
    await expect(act(() => vote.result.current.castAmendmentVote('choice-1'))).rejects.toBe(
      'vote failed'
    );

    mocks.waitForClientApply.mockRejectedValueOnce('election string failure');
    await expect(act(() => election.result.current.castElectionVote(['candidate-1']))).rejects.toBe(
      'election string failure'
    );
    const voteError = new Error('vote error failure');
    mocks.waitForClientApply.mockRejectedValueOnce(voteError);
    await expect(act(() => vote.result.current.castAmendmentVote('choice-1'))).rejects.toBe(
      voteError
    );
    expect(mocks.logError).toHaveBeenCalledTimes(4);
  });

  it('advances election and vote phases only when manageable and identified', async () => {
    mocks.electionActions.updateElection.mockReturnValue(mutationResult());
    mocks.voteActions.updateVote.mockReturnValue(mutationResult());
    const allowed = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', electionId: 'election-1', voteId: 'vote-1' })
    );
    await act(() => allowed.result.current.advanceElectionPhase('closed'));
    await act(() => allowed.result.current.advanceVotePhase('closed'));
    expect(mocks.electionActions.updateElection).toHaveBeenCalledWith({
      id: 'election-1',
      status: 'closed',
    });
    expect(mocks.voteActions.updateVote).toHaveBeenCalledWith({ id: 'vote-1', status: 'closed' });

    mocks.can.mockReturnValue(false);
    const denied = renderHook(() =>
      useVoteCasting({ agendaItemId: 'agenda-1', electionId: 'election-1', voteId: 'vote-1' })
    );
    await act(() => denied.result.current.advanceElectionPhase('final'));
    await act(() => denied.result.current.advanceVotePhase('final'));
    mocks.can.mockReturnValue(true);
    const missing = renderHook(() => useVoteCasting({ agendaItemId: 'agenda-1' }));
    await act(() => missing.result.current.advanceElectionPhase('final'));
    await act(() => missing.result.current.advanceVotePhase('final'));
    expect(mocks.electionActions.updateElection).toHaveBeenCalledTimes(1);
    expect(mocks.voteActions.updateVote).toHaveBeenCalledTimes(1);
  });
});
