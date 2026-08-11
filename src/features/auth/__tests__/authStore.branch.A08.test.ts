import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  storePendingGoogleLanguage: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signInWithOAuth: mocks.signInWithOAuth,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      signOut: mocks.signOut,
    },
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/auth/logic/authRedirects', () => ({
  getAuthRedirectUrl: (path: string) => `https://polity.test${path}`,
}));

vi.mock('@/features/auth/logic/authLanguage', () => ({
  storePendingGoogleLanguage: mocks.storePendingGoogleLanguage,
}));

vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: { getState: () => ({ language: 'de' }) },
}));

import { useAuthStore } from '../auth';

const success = { data: {}, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useAuthStore.setState({ isLoading: false, error: null, pendingEmail: null });
  mocks.signUp.mockResolvedValue(success);
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe('auth store session operations', () => {
  it('starts password sessions and records the selected language for the callback', async () => {
    await expect(
      useAuthStore.getState().signInWithPassword('ada@example.test', 'correct horse')
    ).resolves.toBe(true);

    expect(mocks.storePendingGoogleLanguage).toHaveBeenCalledWith('de');
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.test',
      password: 'correct horse',
    });
    expect(useAuthStore.getState()).toMatchObject({ isLoading: false, error: null });
  });

  it('normalizes structured invalid-credential errors', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'opaque provider text' },
    });

    await expect(
      useAuthStore.getState().signInWithPassword('ada@example.test', 'wrong')
    ).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe('auth.signIn.invalidCredentials');
  });

  it.each([
    [{ status: 502 }, 'status 502'],
    [{ message: 'Upstream server unavailable' }, 'upstream server'],
    [{ message: 'AuthRetryableFetchError' }, 'retryable fetch'],
    [{ message: 'Bad Gateway' }, 'bad gateway'],
    [{ message: 'Failed to fetch' }, 'failed fetch'],
    [{ message: 'Connection refused' }, 'refused connection'],
    [{ message: 'Network request failed' }, 'network request'],
  ])(
    'retries a transient %s failure once and reports service availability',
    async (error, _label) => {
      vi.useFakeTimers();
      mocks.signInWithPassword.mockResolvedValue({ error });

      const pending = useAuthStore.getState().signInWithPassword('ada@example.test', 'secret');
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toBe(false);
      expect(mocks.signInWithPassword).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().error).toBe('common.appErrors.auth_service_unavailable');
    }
  );

  it('does not retry ordinary provider failures', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('provider rejected request') });

    await expect(
      useAuthStore.getState().signInWithPassword('ada@example.test', 'wrong')
    ).resolves.toBe(false);
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().error).toBe('auth.signIn.invalidCredentials');
  });

  it('falls back safely when an SDK boundary returns a non-object error payload', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: 'malformed provider response' });

    await expect(
      useAuthStore.getState().signInWithPassword('ada@example.test', 'wrong')
    ).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe('auth.signIn.invalidCredentials');
  });

  it('starts Google OAuth with the application callback', async () => {
    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBe(true);
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://polity.test/auth/callback' },
    });
  });

  it('surfaces Google OAuth startup failures', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ error: { message: 'provider unavailable' } });

    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe('features.auth.errors.googleSignInFailed');
  });

  it('requests password recovery with a safely encoded destination', async () => {
    await expect(useAuthStore.getState().resetPassword('ada@example.test')).resolves.toBe(true);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('ada@example.test', {
      redirectTo: 'https://polity.test/auth/callback?next=%2Fauth%2Freset-password',
    });
  });

  it('reports password recovery failures', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: 'rejected' } });

    await expect(useAuthStore.getState().resetPassword('ada@example.test')).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe('auth.forgotPassword.sendFailed');
  });
});

describe('auth store registration and passwordless operations', () => {
  it('returns a deterministic failure when signup produces neither user nor session', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });

    await expect(
      useAuthStore.getState().signUpWithPassword('ada@example.test', 'a secure password')
    ).resolves.toEqual({
      status: 'error',
      error: 'auth.signUp.signUpFailed',
    });
    expect(useAuthStore.getState()).toMatchObject({ isLoading: false, error: null });
  });

  it('normalizes weak-password responses', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'weak_password', message: 'provider details' },
    });

    await expect(
      useAuthStore.getState().signUpWithPassword('ada@example.test', 'short')
    ).resolves.toEqual({ status: 'error', error: 'auth.signUp.passwordTooShort' });
  });

  it('sends a localized magic-code request and remembers its email', async () => {
    await expect(useAuthStore.getState().requestMagicCode('ada@example.test')).resolves.toBe(true);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'ada@example.test',
      options: {
        data: { language: 'de' },
        emailRedirectTo: 'https://polity.test/auth/callback',
      },
    });
    expect(useAuthStore.getState()).toMatchObject({
      pendingEmail: 'ada@example.test',
      isLoading: false,
    });
  });

  it('retains the requested email while exposing magic-link delivery failures', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { message: 'mail service rejected request' } });

    await expect(useAuthStore.getState().requestMagicCode('ada@example.test')).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({
      pendingEmail: 'ada@example.test',
      error: 'features.auth.errors.magicLinkFailed',
    });
  });

  it('verifies a magic code and clears the pending email', async () => {
    useAuthStore.setState({ pendingEmail: 'ada@example.test' });

    await expect(
      useAuthStore.getState().verifyMagicCode('ada@example.test', '123456')
    ).resolves.toBe(true);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: 'ada@example.test',
      token: '123456',
      type: 'magiclink',
    });
    expect(useAuthStore.getState().pendingEmail).toBeNull();
  });

  it.each(['otp_expired', 'otp_disabled'])('normalizes %s verification failures', async code => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code } });

    await expect(
      useAuthStore.getState().verifyMagicCode('ada@example.test', 'expired')
    ).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe('features.auth.errors.invalidOrExpiredCode');
  });

  it('rejects a verification response without an authenticated user', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      useAuthStore.getState().verifyMagicCode('ada@example.test', '123456')
    ).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe('features.auth.errors.invalidOrExpiredCode');
  });

  it('signs out and supports local error/loading controls', async () => {
    useAuthStore.setState({ error: 'old error' });
    useAuthStore.getState().clearError();
    useAuthStore.getState().setLoading(true);
    await useAuthStore.getState().signOut();

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(useAuthStore.getState()).toMatchObject({ error: null, isLoading: true });
  });
});
