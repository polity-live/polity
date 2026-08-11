// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authChange: undefined as ((event: string, session: any) => void) | undefined,
  context: undefined as any,
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        mocks.authChange = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
    rpc: mocks.rpc,
  }),
}));

import { AuthProvider, useAuth, useOptionalAuth } from '../auth-provider';

function token(payload: unknown) {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${encoded}.signature`;
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    app_metadata: { provider: 'email', providers: ['email'] },
    ...overrides,
  } as any;
}

function session(accessToken: string | undefined, authUser = user()) {
  return { access_token: accessToken, user: authUser } as any;
}

function Probe() {
  const auth = useAuth();
  mocks.context = auth;
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="auth-loading">{String(auth.authStateLoading)}</span>
      <span data-testid="user">{JSON.stringify(auth.user)}</span>
      <button onClick={() => void auth.refreshAuthState()}>refresh</button>
      <button onClick={() => void auth.signOut()}>sign-out</button>
    </div>
  );
}

async function renderProvider(initialSession: any) {
  mocks.getSession.mockResolvedValueOnce({ data: { session: initialSession } });
  const rendered = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  return rendered;
}

beforeEach(() => {
  mocks.authChange = undefined;
  mocks.context = undefined;
  mocks.getSession.mockReset();
  mocks.getUser.mockReset();
  mocks.signOut.mockReset();
  mocks.rpc.mockReset();
  mocks.unsubscribe.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('requires context for useAuth and keeps optional auth nullable', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
    expect(renderHook(() => useOptionalAuth()).result.current).toBeNull();
  });

  it('loads an empty session, signs out, handles auth events, and unsubscribes', async () => {
    const rendered = await renderProvider(null);
    expect(mocks.context.user).toBeNull();
    expect(mocks.context.session).toBeNull();

    fireEvent.click(screen.getByText('sign-out'));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());

    const nextSession = session(undefined, user());
    act(() => mocks.authChange?.('SIGNED_IN', nextSession));
    await waitFor(() => expect(mocks.context.session).toBe(nextSession));
    act(() => mocks.authChange?.('SIGNED_OUT', null));
    await waitFor(() => expect(mocks.context.user).toBeNull());

    rendered.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it('normalizes password AMR and filters linked provider metadata', async () => {
    const authUser = user({
      email: undefined,
      app_metadata: { provider: 'github', providers: ['github', '', 42, 'google'] },
    });
    const refreshedUser = user({
      id: 'refreshed',
      app_metadata: authUser.app_metadata,
    });
    mocks.getUser.mockResolvedValue({ data: { user: refreshedUser }, error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await renderProvider(
      session(token({ amr: ['password', '', {}, { method: 'mfa' }] }), authUser)
    );

    await waitFor(() => expect(mocks.context.user?.id).toBe('refreshed'));
    expect(mocks.context.user).toMatchObject({
      email: 'user@example.com',
      hasPassword: true,
      linkedProviders: ['github', 'google'],
      primaryProvider: 'github',
      currentAuthMethods: ['password', 'mfa'],
      currentAuthMethod: 'password',
    });
  });

  it('derives otp, oauth, provider-oauth, and unknown methods across token boundaries', async () => {
    const rendered = await renderProvider(
      session(
        token({ amr: [{ method: 'otp' }] }),
        user({ app_metadata: { provider: 'email', providers: [] } })
      )
    );
    await waitFor(() => expect(mocks.context.user?.currentAuthMethod).toBe('otp'));
    expect(mocks.context.user.linkedProviders).toEqual(['email']);

    act(() =>
      mocks.authChange?.(
        'TOKEN_REFRESHED',
        session(
          token({ amr: ['magiclink'] }),
          user({ app_metadata: { provider: '', providers: null } })
        )
      )
    );
    await waitFor(() => expect(mocks.context.user?.currentAuthMethods).toEqual(['magiclink']));
    expect(mocks.context.user.primaryProvider).toBeNull();

    act(() =>
      mocks.authChange?.(
        'TOKEN_REFRESHED',
        session(
          token({ amr: ['oauth'] }),
          user({ app_metadata: { provider: null, providers: {} } })
        )
      )
    );
    await waitFor(() => expect(mocks.context.user?.currentAuthMethod).toBe('oauth'));

    act(() =>
      mocks.authChange?.(
        'TOKEN_REFRESHED',
        session(token({ amr: ['oauth_provider/github'] }), user())
      )
    );
    await waitFor(() => expect(mocks.context.user?.currentAuthMethod).toBe('oauth'));

    for (const accessToken of [undefined, 'single-part', 'header.bad-json.signature', token({})]) {
      act(() => mocks.authChange?.('TOKEN_REFRESHED', session(accessToken, user())));
      await waitFor(() => expect(mocks.context.user?.currentAuthMethod).toBe('unknown'));
    }
    rendered.unmount();
  });

  it('falls back across auth-user, password-state, and request failures', async () => {
    const baseSession = session(token({ amr: ['unknown-method'] }), user());
    const rendered = await renderProvider(baseSession);
    await waitFor(() => expect(mocks.context.user).toBeTruthy());

    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: 'not-boolean', error: null });
    await act(async () => mocks.context.refreshAuthState());
    expect(mocks.context.user).toMatchObject({ id: 'user-1', hasPassword: null });

    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('user failed') });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('password failed') });
    await act(async () => mocks.context.refreshAuthState());
    expect(console.error).toHaveBeenCalledWith('Failed to fetch auth user:', expect.any(Error));
    expect(console.error).toHaveBeenCalledWith('Failed to fetch auth state:', expect.any(Error));

    mocks.getUser.mockRejectedValueOnce(new Error('network failed'));
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    await act(async () => mocks.context.refreshAuthState());
    expect(mocks.context.user).toMatchObject({ id: 'user-1', hasPassword: null });
    expect(console.error).toHaveBeenCalledWith('Failed to fetch auth state:', expect.any(Error));
    expect(mocks.context.authStateLoading).toBe(false);
    rendered.unmount();
  });
});
