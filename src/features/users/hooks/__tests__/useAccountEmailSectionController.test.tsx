/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { email: 'current@example.test', hasPassword: true } as {
    email?: string;
    hasPassword?: boolean;
  } | null,
  authStateLoading: false,
  isUpdating: false,
  updateEmail: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, authStateLoading: mocks.authStateLoading }),
}));
vi.mock('@/features/auth/hooks/useAccountActions', () => ({
  useAccountActions: () => ({
    isUpdating: mocks.isUpdating,
    updateAccountEmail: mocks.updateEmail,
  }),
}));
vi.mock('@/features/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => value }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useAccountEmailSectionController } from '../useAccountEmailSectionController';

function formEvent() {
  return { preventDefault: vi.fn() } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { email: 'current@example.test', hasPassword: true };
  mocks.authStateLoading = false;
  mocks.isUpdating = false;
  mocks.updateEmail.mockResolvedValue({ success: true });
});

describe('useAccountEmailSectionController', () => {
  it('exposes current account state, copy, and busy state', () => {
    mocks.authStateLoading = true;
    const { result, rerender } = renderHook(() => useAccountEmailSectionController());

    expect(result.current.accountEmailProps).toMatchObject({
      currentEmailValue: 'current@example.test',
      isBusy: true,
      isValid: false,
      showEmailError: false,
      showEmailSuccess: false,
    });
    expect(result.current.accountEmailProps.copy.title).toBe('pages.user.accountEmail.title');

    mocks.authStateLoading = false;
    mocks.isUpdating = true;
    rerender();
    expect(result.current.accountEmailProps.isBusy).toBe(true);
    expect(result.current.confirmationDialogProps.isSubmitting).toBe(true);
  });

  it('handles a missing user and initial-password accounts', () => {
    mocks.user = null;
    const missing = renderHook(() => useAccountEmailSectionController());
    expect(missing.result.current.accountEmailProps.currentEmailValue).toBe('');
    expect(missing.result.current.requiresInitialPassword).toBe(false);
    act(() => missing.result.current.accountEmailProps.onNewEmailChange('new@example.test'));
    expect(missing.result.current.accountEmailProps.showEmailSuccess).toBe(true);
    missing.unmount();

    mocks.user = { email: 'passwordless@example.test', hasPassword: false };
    const passwordless = renderHook(() => useAccountEmailSectionController());
    expect(passwordless.result.current.requiresInitialPassword).toBe(true);
  });

  it('validates empty, malformed, unchanged and valid email values', () => {
    const { result } = renderHook(() => useAccountEmailSectionController());

    act(() => result.current.accountEmailProps.onNewEmailBlur());
    expect(result.current.accountEmailProps.showEmailError).toBe(false);

    act(() => result.current.accountEmailProps.onNewEmailChange('invalid'));
    expect(result.current.accountEmailProps).toMatchObject({
      isValid: false,
      showEmailError: true,
      showEmailSuccess: false,
    });

    act(() => result.current.accountEmailProps.onNewEmailChange(' current@example.test '));
    expect(result.current.accountEmailProps).toMatchObject({
      isValid: false,
      showEmailError: false,
      showEmailSuccess: false,
    });

    act(() => result.current.accountEmailProps.onNewEmailChange(' new@example.test '));
    expect(result.current.accountEmailProps).toMatchObject({
      isValid: true,
      showEmailError: false,
      showEmailSuccess: true,
    });
  });

  it('rejects empty and invalid form submissions without calling the account action', async () => {
    const { result } = renderHook(() => useAccountEmailSectionController());
    const emptyEvent = formEvent();
    await act(async () => result.current.accountEmailProps.onSubmit(emptyEvent));
    expect(emptyEvent.preventDefault).toHaveBeenCalled();
    expect(mocks.updateEmail).not.toHaveBeenCalled();

    act(() => result.current.accountEmailProps.onNewEmailChange('invalid'));
    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    expect(result.current.accountEmailProps.error).toBe('auth.signUp.emailHint');
    expect(mocks.updateEmail).not.toHaveBeenCalled();
  });

  it('updates passwordless accounts immediately and resets a successful form', async () => {
    mocks.user = { email: 'old@example.test', hasPassword: false };
    const { result } = renderHook(() => useAccountEmailSectionController());
    act(() => result.current.accountEmailProps.onNewEmailChange(' NEW@example.test '));

    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    expect(mocks.updateEmail).toHaveBeenCalledWith('NEW@example.test');
    expect(result.current.accountEmailProps).toMatchObject({
      newEmail: '',
      error: null,
      showEmailSuccess: false,
    });
  });

  it('shows explicit and empty passwordless update errors', async () => {
    mocks.user = { email: 'old@example.test', hasPassword: false };
    mocks.updateEmail
      .mockResolvedValueOnce({ success: false, error: 'already-used' })
      .mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useAccountEmailSectionController());
    act(() => result.current.accountEmailProps.onNewEmailChange('new@example.test'));

    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    expect(result.current.accountEmailProps.error).toBe('already-used');
    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    expect(result.current.accountEmailProps.error).toBeNull();
  });

  it('opens the password confirmation dialog and clears stale dialog state', async () => {
    const { result } = renderHook(() => useAccountEmailSectionController());
    act(() => result.current.accountEmailProps.onNewEmailChange('new@example.test'));
    act(() => result.current.confirmationDialogProps.onPasswordChange('secret'));

    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: true,
      password: '',
      error: null,
    });
    expect(mocks.updateEmail).not.toHaveBeenCalled();
  });

  it('ignores dialog state changes while updating and resets password and error when closed', async () => {
    mocks.updateEmail.mockResolvedValue({ success: false, error: 'wrong-password' });
    const { result, rerender } = renderHook(() => useAccountEmailSectionController());
    act(() => result.current.accountEmailProps.onNewEmailChange('new@example.test'));
    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    act(() => result.current.confirmationDialogProps.onPasswordChange('bad-secret'));
    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBe('wrong-password');

    mocks.isUpdating = true;
    rerender();
    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    expect(result.current.confirmationDialogProps.open).toBe(true);

    mocks.isUpdating = false;
    rerender();
    act(() => result.current.confirmationDialogProps.onOpenChange(false));
    expect(result.current.confirmationDialogProps).toMatchObject({
      open: false,
      password: '',
      error: null,
    });
    act(() => result.current.confirmationDialogProps.onOpenChange(true));
    expect(result.current.confirmationDialogProps.open).toBe(true);
  });

  it('clears a dialog error when the password changes and supports missing action errors', async () => {
    mocks.updateEmail.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useAccountEmailSectionController());
    act(() => result.current.accountEmailProps.onNewEmailChange('new@example.test'));
    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBeNull();

    mocks.updateEmail.mockResolvedValueOnce({ success: false, error: 'wrong-password' });
    await act(async () => result.current.confirmationDialogProps.onConfirm());
    expect(result.current.confirmationDialogProps.error).toBe('wrong-password');
    act(() => result.current.confirmationDialogProps.onPasswordChange('correct-secret'));
    expect(result.current.confirmationDialogProps.error).toBeNull();
  });

  it('confirms with the current password, resets the form and closes the dialog', async () => {
    const { result } = renderHook(() => useAccountEmailSectionController());
    act(() => result.current.accountEmailProps.onNewEmailChange('new@example.test'));
    await act(async () => result.current.accountEmailProps.onSubmit(formEvent()));
    act(() => result.current.confirmationDialogProps.onPasswordChange('secret'));

    await act(async () => result.current.confirmationDialogProps.onConfirm());
    await waitFor(() => expect(result.current.confirmationDialogProps.open).toBe(false));
    expect(mocks.updateEmail).toHaveBeenCalledWith('new@example.test', 'secret');
    expect(result.current.accountEmailProps.newEmail).toBe('');
    expect(result.current.confirmationDialogProps.password).toBe('');
  });
});
