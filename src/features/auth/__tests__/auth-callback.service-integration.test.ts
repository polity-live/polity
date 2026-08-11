/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storePendingGoogleLanguage } from '../logic/authLanguage';
import { useAuthCallbackPageController } from '../hooks/useAuthCallbackPageController';

const callback = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => callback.navigate }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: callback.exchangeCodeForSession,
      getUser: callback.getUser,
      updateUser: callback.updateUser,
    },
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: callback.toastError } }));

function user(language = 'en') {
  return {
    id: 'callback-user',
    created_at: new Date(Date.now() - 600_000).toISOString(),
    user_metadata: { language },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/auth/callback');
  callback.exchangeCodeForSession.mockResolvedValue({ error: null });
  callback.getUser.mockResolvedValue({ data: { user: user() } });
  callback.updateUser.mockResolvedValue({ error: null });
});

describe('auth callback service integration', () => {
  it('exchanges a valid code, synchronizes pending language and routes to reset-password', async () => {
    storePendingGoogleLanguage('de');
    window.history.replaceState({}, '', '/auth/callback?code=valid&next=/auth/reset-password');
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() =>
      expect(callback.navigate).toHaveBeenCalledWith({ to: '/auth/reset-password' })
    );
    expect(callback.exchangeCodeForSession).toHaveBeenCalledWith('valid');
    expect(callback.updateUser).toHaveBeenCalledWith({ data: { language: 'de' } });
    expect(sessionStorage.getItem('polity_pending_google_language')).toBeNull();
  });

  it('fails closed for an expired code when no fallback session exists', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    callback.exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } });
    callback.getUser.mockResolvedValue({ data: { user: null } });
    window.history.replaceState({}, '', '/auth/callback?code=expired');
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(callback.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' }), {
      timeout: 2_000,
    });
    expect(callback.toastError).toHaveBeenCalledWith('auth.callback.failed');
  });

  it('normalizes an external redirect to the repository-safe home destination', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/callback?code=valid&next=https://attacker.invalid/collect'
    );
    renderHook(() => useAuthCallbackPageController());

    await waitFor(() => expect(callback.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(callback.navigate).not.toHaveBeenCalledWith({
      to: 'https://attacker.invalid/collect',
    });
  });
});
