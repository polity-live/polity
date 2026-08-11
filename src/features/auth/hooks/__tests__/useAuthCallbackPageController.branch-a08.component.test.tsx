/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  consumePendingGoogleLanguage: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/features/auth/logic/authRedirects', () => ({
  getSafeAuthRedirect: (next: string | null) => next || '/',
}));
vi.mock('@/features/auth/logic/authLanguage', () => ({
  consumePendingGoogleLanguage: mocks.consumePendingGoogleLanguage,
  normalizeAuthLanguage: (language: unknown) => (language === 'de' ? 'de' : 'en'),
}));

import { useAuthCallbackPageController } from '../useAuthCallbackPageController';

function user(age = 600_000, language = 'en') {
  return {
    id: 'user-1',
    created_at: new Date(Date.now() - age).toISOString(),
    user_metadata: { language },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  window.history.replaceState({}, '', '/auth/callback');
  sessionStorage.clear();
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: user() } });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.consumePendingGoogleLanguage.mockReturnValue(null);
});

describe('useAuthCallbackPageController', () => {
  it('exchanges an authorization code and respects the validated destination', async () => {
    window.history.replaceState({}, '', '/auth/callback?code=oauth-code&next=%2Fgroups%2Fg-1');
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/groups/g-1' }));
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it('uses an existing session when no authorization code is present', async () => {
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    ['returned', () => Promise.resolve({ error: { message: 'invalid code' } })],
    ['thrown', () => Promise.reject(new Error('exchange transport failed'))],
  ])(
    'falls back to the current session when code exchange is %s as failed',
    async (_kind, exchange) => {
      mocks.exchangeCodeForSession.mockImplementation(exchange);
      window.history.replaceState({}, '', '/auth/callback?code=stale-code');
      renderHook(() => useAuthCallbackPageController());

      await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
      expect(console.warn).toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
    }
  );

  it('waits once for Supabase to publish a delayed session', async () => {
    vi.useFakeTimers();
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValueOnce({ data: { user: user() } });
    renderHook(() => useAuthCallbackPageController());

    await act(async () => vi.runAllTimersAsync());

    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('returns to sign-in when no session appears after the retry', async () => {
    vi.useFakeTimers();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    renderHook(() => useAuthCallbackPageController());

    await act(async () => vi.runAllTimersAsync());

    expect(mocks.toastError).toHaveBeenCalledWith('auth.callback.failed');
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' });
  });

  it('synchronizes a changed language selected before Google OAuth', async () => {
    mocks.consumePendingGoogleLanguage.mockReturnValue('de');
    mocks.getUser.mockResolvedValue({ data: { user: user(600_000, 'en') } });
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { language: 'de' } });
  });

  it.each([
    [null, 'en'],
    ['de', 'de'],
  ])('does not rewrite metadata for pending=%s and current=%s', async (pending, current) => {
    mocks.consumePendingGoogleLanguage.mockReturnValue(pending);
    mocks.getUser.mockResolvedValue({ data: { user: user(600_000, current) } });
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('continues authentication when language synchronization is rejected', async () => {
    mocks.consumePendingGoogleLanguage.mockReturnValue('de');
    mocks.updateUser.mockResolvedValue({ error: { message: 'metadata rejected' } });
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(console.warn).toHaveBeenCalledWith(
      'Failed to synchronize Google auth language:',
      'metadata rejected'
    );
  });

  it.each([
    [120_000, 'true'],
    [600_000, null],
  ])('marks onboarding only for a session created %i ms ago', async (age, expected) => {
    mocks.getUser.mockResolvedValue({ data: { user: user(age) } });
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(sessionStorage.getItem('polity_onboarding')).toBe(expected);
  });

  it('does not navigate after unmounting during a successful callback', async () => {
    let resolveUser!: (value: unknown) => void;
    mocks.getUser.mockReturnValue(new Promise(resolve => (resolveUser = resolve)));
    const { unmount } = renderHook(() => useAuthCallbackPageController());
    unmount();

    await act(async () => resolveUser({ data: { user: user() } }));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('does not navigate or toast after unmounting during a failed callback', async () => {
    let rejectUser!: (error: Error) => void;
    mocks.getUser.mockReturnValue(new Promise((_resolve, reject) => (rejectUser = reject)));
    const { unmount } = renderHook(() => useAuthCallbackPageController());
    unmount();

    await act(async () => rejectUser(new Error('session request failed')));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
