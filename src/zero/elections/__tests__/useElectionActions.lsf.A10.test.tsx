/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const action = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    mutate: vi.fn((descriptor: unknown) => ({ descriptor })),
    onServerError: vi.fn(),
    finalization: vi.fn(),
    trackCreation: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    elections: {
      createElection: action('createElection'),
      startElection: action('startElection'),
      updateElection: action('updateElection'),
      deleteElection: action('deleteElection'),
      addCandidate: action('addCandidate'),
      updateCandidate: action('updateCandidate'),
      deleteCandidate: action('deleteCandidate'),
      createElector: action('createElector'),
      deleteElector: action('deleteElector'),
      submitElectionVote: action('submitElectionVote'),
      upsertOfflineTally: action('upsertOfflineTally'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { elections: mocks.elections } }));
vi.mock('../../mutate-with-server-check', () => ({
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
}));

import { useElectionActions } from '../useElectionActions';

describe('useElectionActions action facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('invokes CRUD, candidate, elector, and tally actions', () => {
    const { result } = renderHook(() => useElectionActions());
    const options = { notificationMode: 'silent' as const };

    result.current.createElection({ id: 'election' } as never, options);
    result.current.updateElection({ id: 'election', status: 'indicative' } as never);
    result.current.updateElection({ id: 'election', status: 'final' } as never);
    result.current.updateElection({ id: 'election', status: 'draft' } as never);
    result.current.deleteElection('election');
    result.current.addCandidate({ id: 'candidate' } as never, options);
    result.current.addCandidateOptimistic({ id: 'optimistic' } as never, options);
    result.current.updateCandidate({ id: 'candidate' } as never);
    result.current.deleteCandidate('candidate');
    result.current.createElector({ id: 'elector' } as never);
    result.current.deleteElector('elector');
    result.current.upsertOfflineTally({ id: 'tally' } as never);

    expect(mocks.elections.startElection).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ phase: 'indicative' })
    );
    expect(mocks.elections.startElection).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ phase: 'final' })
    );
    expect(mocks.elections.updateElection).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' })
    );
    expect(mocks.trackCreation).toHaveBeenCalledTimes(3);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(6);
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it('submits both election phases with tracked and silent options', () => {
    const { result } = renderHook(() => useElectionActions());
    const participation = { election_id: 'election', id: 'participation' } as never;
    const selections = [{ candidate_id: 'one' }, { candidate_id: 'two' }] as never;

    result.current.castIndicativeVote(participation, selections);
    result.current.castIndicativeVote(participation, selections, { silent: true });
    result.current.castFinalVote(participation, selections);
    result.current.castFinalVote(participation, selections, { silent: true });

    expect(mocks.elections.submitElectionVote).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ phase: 'indicative', candidate_ids: ['one', 'two'] })
    );
    expect(mocks.elections.submitElectionVote).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ phase: 'final', candidate_ids: ['one', 'two'] })
    );
    expect(mocks.finalization).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });
});
