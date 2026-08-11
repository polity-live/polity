/* @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../AuthGuard';
import { AuthProvider } from '@/providers/auth-provider';
import { renderComponentFlow } from '@/test/render-component-flow';

const auth = vi.hoisted(() => ({
  initialSession: null as any,
  listener: null as null | ((event: string, session: any) => void),
  navigate: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: auth.getSession,
      getUser: auth.getUser,
      onAuthStateChange: (listener: (event: string, session: any) => void) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      },
      signOut: auth.signOut,
    },
    rpc: auth.rpc,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: window.location.pathname }),
  useNavigate: () => auth.navigate,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: () => <div role="status">auth-loading</div>,
}));

function AuthFlowProvider({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}

function session(id: string) {
  const user = {
    id,
    email: `${id}@polity.local`,
    app_metadata: { provider: 'password', providers: ['password'] },
    user_metadata: {},
  };
  return { access_token: 'header.eyJhbXIiOlsicGFzc3dvcmQiXX0.signature', user };
}

async function finishUnauthenticatedGracePeriod() {
  await act(async () => undefined);
  await act(async () => vi.advanceTimersByTime(100));
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  auth.initialSession = null;
  auth.listener = null;
  auth.navigate.mockReset();
  auth.getSession.mockImplementation(async () => ({ data: { session: auth.initialSession } }));
  auth.getUser.mockImplementation(async () => ({
    data: { user: auth.initialSession?.user ?? null },
    error: null,
  }));
  auth.rpc.mockResolvedValue({ data: true, error: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('authentication session flow', () => {
  it('redirects a protected page without a session and preserves its path', async () => {
    renderComponentFlow(
      <AuthGuard fallback={<p>authentication-required</p>}>protected-content</AuthGuard>,
      { initialUrl: '/group/protected/settings', providers: { auth: AuthFlowProvider } }
    );

    await finishUnauthenticatedGracePeriod();

    expect(screen.getByText('authentication-required')).toBeTruthy();
    expect(auth.navigate).toHaveBeenCalledWith({
      to: '/auth?redirect=%2Fgroup%2Fprotected%2Fsettings',
    });
  });

  it('treats an expired session rejected by the auth client as unauthenticated', async () => {
    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'expired' },
    });
    renderComponentFlow(
      <AuthGuard fallback={<p>session-expired</p>}>protected-content</AuthGuard>,
      { initialUrl: '/home', providers: { auth: AuthFlowProvider } }
    );

    await finishUnauthenticatedGracePeriod();

    expect(screen.getByText('session-expired')).toBeTruthy();
    expect(auth.navigate).toHaveBeenCalledWith({ to: '/auth?redirect=%2Fhome' });
  });

  it('restores protected content after an auth refresh publishes a valid session', async () => {
    renderComponentFlow(
      <AuthGuard fallback={<p>refresh-required</p>}>
        <p>restored-session</p>
      </AuthGuard>,
      { initialUrl: '/notifications', providers: { auth: AuthFlowProvider } }
    );
    await finishUnauthenticatedGracePeriod();
    expect(screen.getByText('refresh-required')).toBeTruthy();

    auth.initialSession = session('refreshed-user');
    await act(async () => auth.listener?.('TOKEN_REFRESHED', auth.initialSession));

    expect(screen.getByText('restored-session')).toBeTruthy();
  });
});
