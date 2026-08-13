/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDecisionVoteDialogController } from '../useDecisionVoteDialogController';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  serverConfirmed: vi.fn(),
  user: { id: 'user-1' } as any,
  voteCasting: {
    phase: 'indication',
    castAmendmentVote: vi.fn(),
    castElectionVote: vi.fn(),
    isLoading: false,
  } as any,
}));

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/vote-cast/hooks/useVoteCasting', () => ({
  useVoteCasting: () => mocks.voteCasting,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({ serverConfirmed: mocks.serverConfirmed }));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    votingPassword: {
      verifyVotingPassword: ({ password }: any) => ({ password }),
    },
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

const voteDecision = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'vote-1',
    sourceId: 'vote-1',
    type: 'vote',
    title: 'Budget',
    body: 'Assembly',
    endsAt: new Date(),
    status: 'active',
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    isClosed: false,
    choices: [{ id: 'accept', label: 'Accept' }],
    ...overrides,
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.serverConfirmed.mockResolvedValue(undefined);
});

describe('useDecisionVoteDialogController', () => {
  it('returns no dialog without a decision', () => {
    const { result } = renderHook(() =>
      useDecisionVoteDialogController({ decision: null, open: false, onOpenChange: vi.fn() })
    );
    expect(result.current.dialogProps).toBeNull();
  });

  it('maps vote defaults, open changes, and successful PIN verification', async () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useDecisionVoteDialogController({
        decision: voteDecision({ phase: undefined }),
        open: true,
        onOpenChange,
      })
    );
    expect(result.current.dialogProps).toMatchObject({
      phase: 'indication',
      choices: [{ id: 'accept', label: 'Accept' }],
      noVotingPasswordSettingsHref: '/user/user-1/settings?tab=passwords',
    });
    act(() => result.current.dialogProps!.onOpenChange(true));
    act(() => result.current.dialogProps!.onOpenChange(false));
    expect(onOpenChange.mock.calls.map(call => call[0])).toEqual([true, false]);
    await act(async () => result.current.dialogProps!.onPasswordSubmit!('1234'));
    expect(mocks.serverConfirmed).toHaveBeenCalled();
  });

  it('maps election candidates and normalizes Error and non-Error PIN failures', async () => {
    mocks.user = null;
    const decision = voteDecision({
      type: 'election',
      phase: 'final',
      choices: undefined,
      candidates: [{ id: 'candidate-1', name: 'Ada', avatarUrl: 'ada.png' }],
    });
    const { result } = renderHook(() =>
      useDecisionVoteDialogController({ decision, open: true, onOpenChange: vi.fn() })
    );
    expect(result.current.dialogProps).toMatchObject({
      phase: 'final',
      choices: undefined,
      candidates: [{ id: 'candidate-1', name: 'Ada', avatar: 'ada.png' }],
      noVotingPasswordSettingsHref: undefined,
    });

    mocks.serverConfirmed.mockRejectedValueOnce(new Error('Invalid PIN'));
    let firstError: unknown;
    await act(async () => {
      try {
        await result.current.dialogProps!.onPasswordSubmit!('0000');
      } catch (error) {
        firstError = error;
      }
    });
    expect(firstError).toBeInstanceOf(Error);
    expect(result.current.dialogProps!.passwordError).toBe('Invalid PIN');

    mocks.serverConfirmed.mockRejectedValueOnce('offline');
    let secondError: unknown;
    await act(async () => {
      try {
        await result.current.dialogProps!.onPasswordSubmit!('1111');
      } catch (error) {
        secondError = error;
      }
    });
    expect(secondError).toBe('offline');
    expect(result.current.dialogProps!.passwordError).toBe(
      'generated.inline.0010_verification_failed_e10d7e51'
    );
  });
});
