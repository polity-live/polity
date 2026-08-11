/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { hasPassword: true } as { hasPassword?: boolean } | null,
  authStateLoading: false,
  hasVotingPassword: false,
  stateLoading: false,
  setVotingPassword: vi.fn(),
  verifyCurrentPassword: vi.fn(),
  stateOptions: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, authStateLoading: mocks.authStateLoading }),
}));
vi.mock('@/features/auth/hooks/useAccountActions', () => ({
  useAccountActions: () => ({ verifyCurrentPassword: mocks.verifyCurrentPassword }),
}));
vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({ setVotingPassword: mocks.setVotingPassword }),
}));
vi.mock('@/zero/voting-password/useVotingPasswordState', () => ({
  useVotingPasswordState: (options: unknown) => {
    mocks.stateOptions(options);
    return {
      hasVotingPassword: mocks.hasVotingPassword,
      isLoading: mocks.stateLoading,
    };
  },
}));
vi.mock('@/features/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => value }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useVotingPasswordTabController } from '../useVotingPasswordTabController';

function formEvent() {
  return { preventDefault: vi.fn() } as any;
}

function enterCodes(
  result: { current: ReturnType<typeof useVotingPasswordTabController> },
  password = '1234',
  confirmation = password
) {
  act(() => result.current.votingPasswordProps.onPasswordChange(password));
  act(() => result.current.votingPasswordProps.onConfirmPasswordChange(confirmation));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { hasPassword: true };
  mocks.authStateLoading = false;
  mocks.hasVotingPassword = false;
  mocks.stateLoading = false;
  mocks.verifyCurrentPassword.mockResolvedValue({ success: true });
  mocks.setVotingPassword.mockResolvedValue(undefined);
});

describe('useVotingPasswordTabController', () => {
  it('forwards user state, translated copy and loading flags', () => {
    mocks.user = null;
    mocks.hasVotingPassword = true;
    mocks.stateLoading = true;
    mocks.authStateLoading = true;
    const { result, rerender } = renderHook(() =>
      useVotingPasswordTabController({ userId: 'user-1' })
    );

    expect(mocks.stateOptions).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result.current).toMatchObject({ requiresInitialPassword: false });
    expect(result.current.votingPasswordProps).toMatchObject({
      hasVotingPassword: true,
      stateLoading: true,
      isBusy: true,
    });
    expect(result.current.votingPasswordProps.copy.title).toBe('pages.user.votingPassword.title');

    mocks.user = { hasPassword: false };
    mocks.authStateLoading = false;
    rerender();
    expect(result.current.requiresInitialPassword).toBe(true);
    expect(result.current.votingPasswordProps.isBusy).toBe(false);
  });

  it('normalizes both codes and reports validation feedback', () => {
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    act(() => {
      result.current.votingPasswordProps.onPasswordBlur();
      result.current.votingPasswordProps.onConfirmPasswordBlur();
    });
    expect(result.current.votingPasswordProps).toMatchObject({
      isValid: false,
      showPasswordError: false,
      showPasswordSuccess: false,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: false,
    });

    act(() => result.current.votingPasswordProps.onPasswordChange('1a2b3456'));
    act(() => result.current.votingPasswordProps.onConfirmPasswordChange('999'));
    expect(result.current.votingPasswordProps).toMatchObject({
      password: '1234',
      confirmPassword: '999',
      isValid: false,
      showPasswordError: false,
      showPasswordSuccess: true,
      showConfirmPasswordError: true,
      showConfirmPasswordSuccess: false,
    });

    act(() => result.current.votingPasswordProps.onConfirmPasswordChange('12-34'));
    expect(result.current.votingPasswordProps).toMatchObject({
      confirmPassword: '1234',
      isValid: true,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: true,
    });
  });

  it('covers short password and empty-confirmation validation boundaries', () => {
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    act(() => result.current.votingPasswordProps.onPasswordChange('12'));
    expect(result.current.votingPasswordProps).toMatchObject({
      isValid: false,
      showPasswordError: true,
      showPasswordSuccess: false,
    });
    act(() => result.current.votingPasswordProps.onConfirmPasswordChange(''));
    expect(result.current.votingPasswordProps.showConfirmPasswordError).toBe(false);
  });

  it('rejects mismatched and invalid-format submissions before opening the dialog', async () => {
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    const event = formEvent();
    enterCodes(result, '1234', '9999');
    await act(async () => result.current.votingPasswordProps.onSubmit(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.votingPasswordProps.error).toBe('pages.user.votingPassword.mismatch');

    enterCodes(result, '12', '12');
    await act(async () => result.current.votingPasswordProps.onSubmit(formEvent()));
    expect(result.current.votingPasswordProps.error).toBe(
      'pages.user.votingPassword.invalidFormat'
    );
    expect(result.current.confirmationDialogProps.open).toBe(false);
  });

  it('opens and manually closes the confirmation dialog with clean state', async () => {
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    enterCodes(result);
    act(() => result.current.confirmationDialogProps.onPasswordChange('stale'));
    await act(async () => result.current.votingPasswordProps.onSubmit(formEvent()));
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: true,
      password: '',
      error: null,
    });

    act(() => result.current.confirmationDialogProps.onPasswordChange('current-secret'));
    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: false,
      password: '',
      error: null,
    });
    act(() => result.current.confirmationDialogProps.onOpenChange(true));
    expect(result.current.confirmationDialogProps.open).toBe(true);
  });

  it('keeps the dialog open for failed verification and handles missing errors', async () => {
    mocks.verifyCurrentPassword
      .mockResolvedValueOnce({ success: false, error: 'wrong-password' })
      .mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    enterCodes(result);
    await act(async () => result.current.votingPasswordProps.onSubmit(formEvent()));

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBe('wrong-password');
    expect(mocks.setVotingPassword).not.toHaveBeenCalled();
    act(() => result.current.confirmationDialogProps.onPasswordChange('retry'));
    expect(result.current.confirmationDialogProps.error).toBeNull();

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBeNull();
  });

  it('blocks closing while verification is pending and saves after success', async () => {
    let resolveVerification!: (result: { success: boolean }) => void;
    mocks.verifyCurrentPassword.mockReturnValue(
      new Promise(resolve => {
        resolveVerification = resolve;
      })
    );
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    enterCodes(result);
    await act(async () => result.current.votingPasswordProps.onSubmit(formEvent()));
    act(() => result.current.confirmationDialogProps.onPasswordChange('current-secret'));

    let confirmationPromise!: Promise<void>;
    act(() => {
      confirmationPromise = result.current.confirmationDialogProps.onConfirm();
    });
    expect(result.current.confirmationDialogProps.isSubmitting).toBe(true);
    expect(result.current.votingPasswordProps.isBusy).toBe(true);
    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    expect(result.current.confirmationDialogProps.open).toBe(true);

    await act(async () => {
      resolveVerification({ success: true });
      await confirmationPromise;
    });
    await waitFor(() => expect(result.current.confirmationDialogProps.open).toBe(false));
    expect(mocks.setVotingPassword).toHaveBeenCalledWith('1234');
    expect(result.current.votingPasswordProps).toMatchObject({ password: '', confirmPassword: '' });
    expect(result.current.confirmationDialogProps.isSubmitting).toBe(false);
  });

  it('shows thrown Error messages and a translated fallback for non-Errors', async () => {
    mocks.setVotingPassword
      .mockRejectedValueOnce(new Error('storage-offline'))
      .mockRejectedValueOnce('unknown');
    const { result } = renderHook(() => useVotingPasswordTabController({ userId: 'user-1' }));
    enterCodes(result);
    await act(async () => result.current.votingPasswordProps.onSubmit(formEvent()));

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBe('storage-offline');
    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBe(
      'pages.user.votingPassword.saveFailed'
    );
    expect(result.current.confirmationDialogProps.isSubmitting).toBe(false);
  });
});
