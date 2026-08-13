/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { hasPassword: true } as { hasPassword?: boolean } | null,
  authStateLoading: false,
  isUpdating: false,
  updatePassword: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, authStateLoading: mocks.authStateLoading }),
}));
vi.mock('@/features/auth/hooks/useAccountActions', () => ({
  useAccountActions: () => ({
    isUpdating: mocks.isUpdating,
    updateAccountPassword: mocks.updatePassword,
  }),
}));
vi.mock('@/features/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => value }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useAccountPasswordSectionController } from '../useAccountPasswordSectionController';

const VALID_PASSWORD = 'secret1';

function formEvent() {
  return { preventDefault: vi.fn() } as any;
}

function enterPasswords(
  result: { current: ReturnType<typeof useAccountPasswordSectionController> },
  password = VALID_PASSWORD,
  confirmation = password
) {
  act(() => result.current.accountPasswordProps.onPasswordChange(password));
  act(() => result.current.accountPasswordProps.onConfirmPasswordChange(confirmation));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { hasPassword: true };
  mocks.authStateLoading = false;
  mocks.isUpdating = false;
  mocks.updatePassword.mockResolvedValue({ success: true });
});

describe('useAccountPasswordSectionController', () => {
  it('exposes translated copy, account kind and loading state', () => {
    mocks.user = null;
    mocks.authStateLoading = true;
    const { result, rerender } = renderHook(() => useAccountPasswordSectionController());
    expect(result.current.requiresInitialPassword).toBe(false);
    expect(result.current.accountPasswordProps).toMatchObject({ isBusy: true, isValid: false });
    expect(result.current.accountPasswordProps.copy.title).toBe('pages.user.accountPassword.title');

    mocks.user = { hasPassword: false };
    mocks.authStateLoading = false;
    mocks.isUpdating = true;
    rerender();
    expect(result.current.requiresInitialPassword).toBe(true);
    expect(result.current.accountPasswordProps.isBusy).toBe(true);
    expect(result.current.confirmationDialogProps.isSubmitting).toBe(true);
  });

  it('reports password and confirmation validation states at every boundary', () => {
    const { result } = renderHook(() => useAccountPasswordSectionController());
    act(() => {
      result.current.accountPasswordProps.onPasswordBlur();
      result.current.accountPasswordProps.onConfirmPasswordBlur();
    });
    expect(result.current.accountPasswordProps).toMatchObject({
      showPasswordError: false,
      showPasswordSuccess: false,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: false,
    });

    act(() => result.current.accountPasswordProps.onPasswordChange('short'));
    act(() => result.current.accountPasswordProps.onConfirmPasswordChange('other'));
    expect(result.current.accountPasswordProps).toMatchObject({
      isValid: false,
      showPasswordError: true,
      showPasswordSuccess: false,
      showConfirmPasswordError: true,
      showConfirmPasswordSuccess: false,
    });

    act(() => result.current.accountPasswordProps.onPasswordChange(VALID_PASSWORD));
    expect(result.current.accountPasswordProps).toMatchObject({
      isValid: false,
      showPasswordError: false,
      showPasswordSuccess: true,
      showConfirmPasswordError: true,
    });
    act(() => result.current.accountPasswordProps.onConfirmPasswordChange(VALID_PASSWORD));
    expect(result.current.accountPasswordProps).toMatchObject({
      isValid: true,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: true,
    });
  });

  it('distinguishes an absent confirmation from an invalid password in isValid', () => {
    const { result } = renderHook(() => useAccountPasswordSectionController());
    act(() => result.current.accountPasswordProps.onPasswordChange(VALID_PASSWORD));
    expect(result.current.accountPasswordProps.isValid).toBe(false);
    act(() => result.current.accountPasswordProps.onPasswordChange('short'));
    act(() => result.current.accountPasswordProps.onConfirmPasswordChange('short'));
    expect(result.current.accountPasswordProps.isValid).toBe(false);
  });

  it('rejects short and mismatched submissions with specific copy', async () => {
    const { result } = renderHook(() => useAccountPasswordSectionController());
    const event = formEvent();
    await act(async () => result.current.accountPasswordProps.onSubmit(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.accountPasswordProps.error).toBe('pages.user.accountPassword.tooShort');

    enterPasswords(result, VALID_PASSWORD, 'different');
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    expect(result.current.accountPasswordProps.error).toBe('pages.user.accountPassword.mismatch');
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('handles verification-required, success and failure for an initial password', async () => {
    mocks.user = { hasPassword: false };
    mocks.updatePassword
      .mockResolvedValueOnce({ success: false, verificationRequired: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'rejected' })
      .mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useAccountPasswordSectionController());
    enterPasswords(result);

    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    expect(result.current.confirmationDialogProps).toMatchObject({ open: true, mode: 'code' });
    expect(mocks.updatePassword).toHaveBeenLastCalledWith(VALID_PASSWORD);

    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    expect(result.current.accountPasswordProps.password).toBe('');

    enterPasswords(result);
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    expect(result.current.accountPasswordProps.error).toBe('rejected');
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    expect(result.current.accountPasswordProps.error).toBeNull();
  });

  it('opens a password dialog for an existing password and clears stale values', async () => {
    const { result } = renderHook(() => useAccountPasswordSectionController());
    enterPasswords(result);
    act(() => result.current.confirmationDialogProps.onPasswordChange('old'));
    act(() => result.current.confirmationDialogProps.onCodeChange('123456'));

    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: true,
      mode: 'password',
      password: '',
      code: '',
      error: null,
    });
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('switches from password to code verification and confirms with the code', async () => {
    mocks.updatePassword
      .mockResolvedValueOnce({ success: false, verificationRequired: true })
      .mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useAccountPasswordSectionController());
    enterPasswords(result);
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    act(() => result.current.confirmationDialogProps.onPasswordChange('old-password'));

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(mocks.updatePassword).toHaveBeenLastCalledWith(
      VALID_PASSWORD,
      'old-password',
      undefined
    );
    expect(result.current.confirmationDialogProps).toMatchObject({
      mode: 'code',
      code: '',
      error: null,
    });

    act(() => result.current.confirmationDialogProps.onCodeChange('654321'));
    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(mocks.updatePassword).toHaveBeenLastCalledWith(VALID_PASSWORD, 'old-password', '654321');
    expect(result.current.accountPasswordProps.password).toBe('');
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: false,
      mode: 'password',
      password: '',
      code: '',
    });
  });

  it('shows explicit and empty confirmation errors and clears them on input', async () => {
    mocks.updatePassword
      .mockResolvedValueOnce({ success: false, error: 'wrong-password' })
      .mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useAccountPasswordSectionController());
    enterPasswords(result);
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBe('wrong-password');
    act(() => result.current.confirmationDialogProps.onPasswordChange('correct'));
    expect(result.current.confirmationDialogProps.error).toBeNull();

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBeNull();
    act(() => result.current.confirmationDialogProps.onCodeChange('111111'));
    expect(result.current.confirmationDialogProps.error).toBeNull();
  });

  it('blocks dialog changes while updating and fully resets when closed', async () => {
    const { result, rerender } = renderHook(() => useAccountPasswordSectionController());
    enterPasswords(result);
    await act(async () => result.current.accountPasswordProps.onSubmit(formEvent()));
    act(() => result.current.confirmationDialogProps.onPasswordChange('old'));

    mocks.isUpdating = true;
    rerender();
    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    expect(result.current.confirmationDialogProps.open).toBe(true);

    mocks.isUpdating = false;
    rerender();
    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: false,
      mode: 'password',
      password: '',
      code: '',
      error: null,
    });
    act(() => result.current.confirmationDialogProps.onOpenChange(true));
    expect(result.current.confirmationDialogProps.open).toBe(true);
  });
});
