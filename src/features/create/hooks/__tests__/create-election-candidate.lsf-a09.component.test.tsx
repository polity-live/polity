/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addCandidate: vi.fn(),
  track: vi.fn(),
  wait: vi.fn(async () => undefined),
  toastError: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ addCandidateOptimistic: mocks.addCandidate }),
}));
vi.mock('@/zero/elections/useElectionState', () => ({
  useElectionState: () => ({
    electionsForSearch: [
      {
        id: 'election',
        title: 'Election',
        agenda_item_id: 'agenda',
        agenda_item: { id: 'agenda', event: { id: 'event', group_id: 'group' } },
      },
    ],
  }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({ participations: [] }),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useCurrentUserActiveGroupIds: () => ({ activeGroupIds: new Set(['group']) }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('../../logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => null,
  trackCreateFinalization: mocks.track,
  waitForOptimisticCreate: mocks.wait,
}));

import { useCreateElectionCandidateForm } from '../useCreateElectionCandidateForm';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000009');
  mocks.addCandidate.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
});

it('executes optional/review validation and retry finalization', async () => {
  const { result } = renderHook(() => useCreateElectionCandidateForm());
  const election = result.current.steps[0].fields?.[0] as any;
  act(() => election.props.onChange('election'));
  expect(result.current.steps[1].isValid()).toBe(true);
  expect(result.current.steps[2].isValid()).toBe(true);
  expect(result.current.steps[2].getInvalidReason?.()).toBeNull();
  await act(async () => void (await result.current.onSubmit?.()));
  mocks.track.mock.calls[0][0].retry();
  expect(mocks.addCandidate).toHaveBeenCalledTimes(2);
  expect(mocks.track).toHaveBeenCalledTimes(2);
});

it('restores submitting state and reports a synchronous candidate failure', async () => {
  mocks.addCandidate.mockImplementation(() => {
    throw new Error('candidate failed');
  });
  const { result } = renderHook(() => useCreateElectionCandidateForm());
  const electionField = result.current.steps[0].fields?.[0] as any;
  act(() => electionField.props.onChange('election'));
  await expect(act(async () => void (await result.current.onSubmit?.()))).rejects.toThrow(
    'candidate failed'
  );
  expect(mocks.toastError).toHaveBeenCalled();
  expect(result.current.isSubmitting).toBe(false);
});
