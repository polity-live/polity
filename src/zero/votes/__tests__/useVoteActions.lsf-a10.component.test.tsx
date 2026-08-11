/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const action = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    mutate: vi.fn((descriptor: unknown) => ({ descriptor })),
    onServerError: vi.fn(),
    finalization: vi.fn(),
    isCancellation: vi.fn(),
    trackCreation: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    votes: {
      createVote: action('createVote'),
      startVote: action('startVote'),
      updateVote: action('updateVote'),
      deleteVote: action('deleteVote'),
      closeExpiredFinalVotesForEvent: action('closeExpiredFinalVotesForEvent'),
      createVoteChoice: action('createVoteChoice'),
      updateVoteChoice: action('updateVoteChoice'),
      deleteVoteChoice: action('deleteVoteChoice'),
      createVoter: action('createVoter'),
      deleteVoter: action('deleteVoter'),
      submitVote: action('submitVote'),
      upsertOfflineTally: action('upsertOfflineTally'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { votes: mocks.votes } }));
vi.mock('../../mutate-with-server-check', () => ({
  isZeroClosedMutationCancellation: (message: string) => mocks.isCancellation(message),
  onServerError: (result: unknown, callback: (message: string) => void) => {
    mocks.onServerError(result);
    callback('server error');
  },
  trackServerFinalization: (
    result: unknown,
    callbacks: { onSuccess: () => void; onError: () => void }
  ) => {
    mocks.finalization(result);
    callbacks.onSuccess();
    callbacks.onError();
  },
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

import { useVoteActions } from '../useVoteActions';

describe('useVoteActions action facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCancellation.mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('invokes CRUD, choice, voter, tally, and close-expired actions', () => {
    const { result } = renderHook(() => useVoteActions());
    const options = { notificationMode: 'silent' as const };

    result.current.createVote({ id: 'vote' } as never, options);
    result.current.updateVote({ id: 'vote', status: 'indicative' } as never);
    result.current.updateVote({ id: 'vote', status: 'final' } as never);
    result.current.updateVote({ id: 'vote', status: 'draft' } as never);
    result.current.deleteVote('vote');
    result.current.createVoteChoice({ id: 'choice' } as never);
    result.current.updateVoteChoice({ id: 'choice' } as never);
    result.current.deleteVoteChoice('choice');
    result.current.createVoter({ id: 'voter' } as never);
    result.current.deleteVoter('voter');
    result.current.upsertOfflineTally({ id: 'tally' } as never);

    result.current.closeExpiredFinalVotesForEvent({ event_id: 'event' } as never);
    mocks.isCancellation.mockReturnValueOnce(true);
    result.current.closeExpiredFinalVotesForEvent({ event_id: 'event' } as never);

    expect(mocks.votes.startVote).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ phase: 'indicative' })
    );
    expect(mocks.votes.startVote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ phase: 'final' })
    );
    expect(mocks.votes.updateVote).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' })
    );
    expect(mocks.trackCreation).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
    expect(mocks.toastError).toHaveBeenCalledTimes(5);
    expect(console.error).toHaveBeenCalledTimes(6);
  });

  it('submits both vote phases with tracked and silent options', () => {
    const { result } = renderHook(() => useVoteActions());
    const participation = { vote_id: 'vote', id: 'participation' } as never;
    const decisions = [{ choice_id: 'one' }, { choice_id: 'two' }] as never;

    result.current.castIndicativeVote(participation, decisions);
    result.current.castIndicativeVote(participation, decisions, { silent: true });
    result.current.castFinalVote(participation, decisions);
    result.current.castFinalVote(participation, decisions, { silent: true });

    expect(mocks.votes.submitVote).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ phase: 'indicative', choice_ids: ['one', 'two'] })
    );
    expect(mocks.votes.submitVote).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ phase: 'final', choice_ids: ['one', 'two'] })
    );
    expect(mocks.finalization).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });
});
