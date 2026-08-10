/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVotingPasswordActions } from '../useVotingPasswordActions';

const { mutate, serverConfirmed, success, errorToast, showVotingPasswordErrorToast } = vi.hoisted(
  () => ({
    mutate: vi.fn(),
    serverConfirmed: vi.fn(),
    success: vi.fn(),
    errorToast: vi.fn(),
    showVotingPasswordErrorToast: vi.fn(),
  })
);

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success, error: errorToast },
}));
vi.mock('@/features/notifications/utils/voting-password-error-toast', () => ({
  showVotingPasswordErrorToast,
}));
vi.mock('../../mutators', () => ({
  mutators: {
    votingPassword: {
      setVotingPassword: (args: unknown) => ({ kind: 'set', args }),
      verifyVotingPassword: (args: unknown) => ({ kind: 'verify', args }),
    },
  },
}));
vi.mock('../../mutate-with-server-check', () => ({ serverConfirmed }));

beforeEach(() => {
  vi.clearAllMocks();
  mutate.mockReturnValue({ server: Promise.resolve({ type: 'ok' }) });
  serverConfirmed.mockResolvedValue(undefined);
});

describe('useVotingPasswordActions', () => {
  it('reports successful password setup and verification', async () => {
    const { result } = renderHook(() => useVotingPasswordActions());

    await act(async () => result.current.setVotingPassword('1234'));
    await act(async () => result.current.verifyVotingPassword('1234'));

    expect(mutate).toHaveBeenNthCalledWith(1, { kind: 'set', args: { password: '1234' } });
    expect(mutate).toHaveBeenNthCalledWith(2, { kind: 'verify', args: { password: '1234' } });
    expect(success).toHaveBeenCalledWith('common.votingPassword.setSuccess');
  });

  it.each([
    [new Error('setup failed'), 'setup failed'],
    [new Error(''), 'common.votingPassword.setFailed'],
    ['rejected', 'common.votingPassword.setFailed'],
  ])('normalizes setup failure %p', async (failure, expected) => {
    serverConfirmed.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useVotingPasswordActions());

    await expect(result.current.setVotingPassword('1234')).rejects.toBe(failure);
    expect(errorToast).toHaveBeenCalledWith(expected);
  });

  it.each([
    [new Error('verify failed'), 'verify failed'],
    [new Error(''), 'common.votingPassword.verifyFailed'],
    [{ rejected: true }, 'common.votingPassword.verifyFailed'],
  ])('normalizes verification failure %p', async (failure, expected) => {
    serverConfirmed.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useVotingPasswordActions());

    await expect(result.current.verifyVotingPassword('1234')).rejects.toBe(failure);
    expect(showVotingPasswordErrorToast).toHaveBeenCalledWith(expected, 'user-1');
  });
});
