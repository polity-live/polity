/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVotePasswordConfirmation } from '../useVotePasswordConfirmation';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  serverConfirmed: vi.fn(),
  toast: vi.fn(),
  localize: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/zero/mutators', () => ({
  mutators: { votingPassword: { verifyVotingPassword: (args: unknown) => ({ args }) } },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (...args: unknown[]) => mocks.serverConfirmed(...args),
}));
vi.mock('@/features/notifications/utils/voting-password-error-toast', () => ({
  showVotingPasswordErrorToast: (...args: unknown[]) => mocks.toast(...args),
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (...args: unknown[]) => mocks.localize(...args),
}));

describe('useVotePasswordConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
    mocks.serverConfirmed.mockResolvedValue(undefined);
    mocks.localize.mockReturnValue('Localized failure');
  });

  it('opens, verifies, runs the pending callback, and closes', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useVotePasswordConfirmation());
    act(() => result.current.requestConfirmation(callback));
    expect(result.current.isOpen).toBe(true);

    await act(() => result.current.submitPassword('secret'));
    expect(mocks.mutate).toHaveBeenCalledWith({ args: { password: 'secret' } });
    expect(mocks.serverConfirmed).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
    expect(result.current).toEqual(
      expect.objectContaining({ isOpen: false, isVerifying: false, error: null })
    );
  });

  it('supports direct verification without a pending callback', async () => {
    const { result } = renderHook(() => useVotePasswordConfirmation());
    await act(() => result.current.submitPassword('secret'));
    expect(result.current.isOpen).toBe(false);
  });

  it('localizes failures and lets the user close the dialog', async () => {
    const failure = new Error('bad password');
    mocks.serverConfirmed.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useVotePasswordConfirmation());
    act(() => result.current.requestConfirmation(vi.fn()));
    await act(() => result.current.submitPassword('wrong'));
    expect(result.current.error).toBe('Localized failure');
    expect(mocks.toast).toHaveBeenCalledWith(failure, 'user-1');

    act(() => result.current.close());
    expect(result.current).toEqual(expect.objectContaining({ isOpen: false, error: null }));
  });
});
