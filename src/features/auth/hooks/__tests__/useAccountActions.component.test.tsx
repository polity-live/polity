/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { email: 'person@example.test', hasPassword: true } as {
    email?: string;
    hasPassword: boolean | null;
  } | null,
  authStateLoading: false,
  refresh: vi.fn(),
  signOut: vi.fn(),
  createClient: vi.fn(),
  signIn: vi.fn(),
  reauthenticate: vi.fn(),
  updateUser: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: mocks.user,
    authStateLoading: mocks.authStateLoading,
    refreshAuthState: mocks.refresh,
    signOut: mocks.signOut,
  }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock('@/features/auth/logic/authRedirects', () => ({
  getAuthRedirectUrl: (...args: unknown[]) => mocks.redirect(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useAccountActions } from '../useAccountActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { email: 'person@example.test', hasPassword: true };
  mocks.authStateLoading = false;
  mocks.refresh.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue(undefined);
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.reauthenticate.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({
    data: { user: { email: 'person@example.test' } },
    error: null,
  });
  mocks.redirect.mockReturnValue('https://app.test/auth/callback');
  mocks.createClient.mockReturnValue({
    auth: {
      signInWithPassword: mocks.signIn,
      reauthenticate: mocks.reauthenticate,
      updateUser: mocks.updateUser,
    },
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('verifyCurrentPassword', () => {
  it('rejects loading, unknown password state, passwordless accounts and blank passwords', async () => {
    const { result, rerender } = renderHook(() => useAccountActions());
    mocks.authStateLoading = true;
    rerender();
    await expect(result.current.verifyCurrentPassword('secret')).resolves.toEqual({
      success: false,
      error: 'pages.user.securityConfirmation.unavailable',
    });

    mocks.authStateLoading = false;
    mocks.user = { email: 'person@example.test', hasPassword: null };
    rerender();
    await expect(result.current.verifyCurrentPassword('secret')).resolves.toMatchObject({
      success: false,
    });

    mocks.user = { email: 'person@example.test', hasPassword: false };
    rerender();
    await expect(result.current.verifyCurrentPassword('secret')).resolves.toEqual({
      success: false,
      error: 'pages.user.securityConfirmation.initialPasswordRequired',
    });

    mocks.user = { email: 'person@example.test', hasPassword: true };
    rerender();
    await expect(result.current.verifyCurrentPassword('')).resolves.toEqual({
      success: false,
      error: 'pages.user.securityConfirmation.passwordRequired',
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects users without email and invalid passwords', async () => {
    mocks.user = { hasPassword: true };
    const { result, rerender } = renderHook(() => useAccountActions());
    await expect(result.current.verifyCurrentPassword('secret')).resolves.toMatchObject({
      success: false,
    });

    mocks.user = { email: 'person@example.test', hasPassword: true };
    mocks.signIn.mockResolvedValue({ error: new Error('invalid') });
    rerender();
    await expect(result.current.verifyCurrentPassword('wrong')).resolves.toEqual({
      success: false,
      error: 'pages.user.securityConfirmation.invalidPassword',
    });
  });

  it('verifies valid credentials and converts thrown failures to unavailable', async () => {
    const { result } = renderHook(() => useAccountActions());
    await expect(result.current.verifyCurrentPassword('secret')).resolves.toEqual({
      success: true,
    });
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'secret',
    });

    mocks.signIn.mockRejectedValueOnce(new Error('offline'));
    await expect(result.current.verifyCurrentPassword('secret')).resolves.toEqual({
      success: false,
      error: 'pages.user.securityConfirmation.unavailable',
    });
  });
});

describe('updateAccountPassword', () => {
  it('rejects loading, missing users and unknown password state while always ending loading', async () => {
    const { result, rerender } = renderHook(() => useAccountActions());
    mocks.authStateLoading = true;
    rerender();
    await act(async () =>
      expect(result.current.updateAccountPassword('new-secret')).resolves.toMatchObject({
        success: false,
      })
    );
    mocks.authStateLoading = false;
    mocks.user = null;
    rerender();
    await act(async () =>
      expect(result.current.updateAccountPassword('new-secret')).resolves.toMatchObject({
        success: false,
      })
    );
    mocks.user = { email: 'person@example.test', hasPassword: null };
    rerender();
    await act(async () =>
      expect(result.current.updateAccountPassword('new-secret')).resolves.toMatchObject({
        success: false,
      })
    );
    expect(result.current.isUpdating).toBe(false);
  });

  it('returns password verification failures before reauthentication', async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () =>
      expect(result.current.updateAccountPassword('new-secret')).resolves.toEqual({
        success: false,
        error: 'pages.user.securityConfirmation.passwordRequired',
      })
    );
    expect(mocks.reauthenticate).not.toHaveBeenCalled();
  });

  it('requests a verification nonce after current-password verification', async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () =>
      expect(result.current.updateAccountPassword('new-secret', 'old-secret')).resolves.toEqual({
        success: false,
        verificationRequired: true,
      })
    );
    expect(mocks.signIn).toHaveBeenCalled();
    expect(mocks.reauthenticate).toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('updates with nonce and includes current password only when applicable', async () => {
    const { result, rerender } = renderHook(() => useAccountActions());
    await act(async () =>
      expect(
        result.current.updateAccountPassword('new-secret', 'old-secret', 'nonce-1')
      ).resolves.toEqual({ success: true })
    );
    expect(mocks.updateUser).toHaveBeenLastCalledWith({
      password: 'new-secret',
      nonce: 'nonce-1',
      current_password: 'old-secret',
    });

    await act(async () =>
      result.current.updateAccountPassword('next-secret', undefined, 'nonce-2')
    );
    expect(mocks.updateUser).toHaveBeenLastCalledWith({
      password: 'next-secret',
      nonce: 'nonce-2',
    });

    mocks.user = { email: 'person@example.test', hasPassword: false };
    rerender();
    await act(async () =>
      result.current.updateAccountPassword('initial-secret', 'ignored', 'nonce-3')
    );
    expect(mocks.updateUser).toHaveBeenLastCalledWith({
      password: 'initial-secret',
      nonce: 'nonce-3',
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(3);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('pages.user.accountPassword.success');
  });

  it('reports reauthentication and update errors', async () => {
    const { result } = renderHook(() => useAccountActions());
    mocks.reauthenticate.mockResolvedValueOnce({ error: new Error('reauth failed') });
    await act(async () =>
      expect(result.current.updateAccountPassword('new-secret', 'old-secret')).resolves.toEqual({
        success: false,
        error: 'pages.user.accountPassword.failed',
      })
    );

    mocks.updateUser.mockResolvedValueOnce({ data: {}, error: new Error('update failed') });
    await act(async () =>
      expect(
        result.current.updateAccountPassword('new-secret', 'old-secret', 'nonce')
      ).resolves.toMatchObject({ success: false })
    );
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.accountPassword.failed');
  });
});

describe('updateAccountEmail', () => {
  it('rejects each unavailable auth state', async () => {
    const { result, rerender } = renderHook(() => useAccountActions());
    mocks.authStateLoading = true;
    rerender();
    await act(async () =>
      expect(result.current.updateAccountEmail('new@example.test')).resolves.toMatchObject({
        success: false,
      })
    );
    mocks.authStateLoading = false;
    mocks.user = null;
    rerender();
    await act(async () =>
      expect(result.current.updateAccountEmail('new@example.test')).resolves.toMatchObject({
        success: false,
      })
    );
    mocks.user = { email: 'old@example.test', hasPassword: null };
    rerender();
    await act(async () =>
      expect(result.current.updateAccountEmail('new@example.test')).resolves.toMatchObject({
        success: false,
      })
    );
  });

  it('returns current-password verification failures for password accounts', async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () =>
      expect(result.current.updateAccountEmail('new@example.test')).resolves.toEqual({
        success: false,
        error: 'pages.user.securityConfirmation.passwordRequired',
      })
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('reports immediate updates, confirmation mail and missing returned users', async () => {
    mocks.user = { email: 'old@example.test', hasPassword: false };
    mocks.updateUser
      .mockResolvedValueOnce({ data: { user: { email: 'new@example.test' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { email: 'old@example.test' } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    const { result } = renderHook(() => useAccountActions());

    await act(async () => result.current.updateAccountEmail('new@example.test'));
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith('pages.user.accountEmail.success');
    expect(mocks.updateUser).toHaveBeenLastCalledWith(
      { email: 'new@example.test' },
      { emailRedirectTo: 'https://app.test/auth/callback' }
    );
    await act(async () => result.current.updateAccountEmail('next@example.test'));
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith('pages.user.accountEmail.confirmationSent');
    await act(async () => result.current.updateAccountEmail('third@example.test'));
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith('pages.user.accountEmail.confirmationSent');
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/callback');
  });

  it('verifies password accounts and reports update failures', async () => {
    const { result } = renderHook(() => useAccountActions());
    mocks.updateUser.mockResolvedValueOnce({ data: {}, error: new Error('email failed') });
    await act(async () =>
      expect(result.current.updateAccountEmail('new@example.test', 'old-secret')).resolves.toEqual({
        success: false,
        error: 'pages.user.accountEmail.failed',
      })
    );
    expect(mocks.signIn).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.accountEmail.failed');
  });
});
