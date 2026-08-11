/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  search: {} as Record<string, string>,
  navigate: vi.fn(),
  authError: null as string | null,
  clearError: vi.fn(),
  resetPassword: vi.fn(),
  signingIn: false,
  signInWithGoogle: vi.fn(),
  toastError: vi.fn(),
  passwordValid: false,
  passwordsEqual: false,
  updateUser: vi.fn(),
  signOut: vi.fn(),
  auth: {
    user: null as null | { id: string },
    loading: false,
    session: null as null | { access_token: string },
  },
  userState: { currentUser: null as null | { id: string }, isLoading: false },
  routeAccess: vi.fn(),
  recoveryDraft: null as any,
  visibilityDecision: { allowed: true } as {
    allowed: boolean;
    reason?: 'login-required' | 'private';
  },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  useSearch: () => state.search,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({
    error: state.authError,
    clearError: state.clearError,
    signInWithGoogle: state.signInWithGoogle,
  }),
}));
vi.mock('../useAuthSignIn', () => ({
  useAuthSignIn: () => ({ isSigningIn: state.signingIn, resetPassword: state.resetPassword }),
}));
vi.mock('@/features/auth/logic/authValidation', () => ({
  isValidPassword: () => state.passwordValid,
  passwordsMatch: () => state.passwordsEqual,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser: state.updateUser, signOut: state.signOut } }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: state.toastError } }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => state.auth }));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => state.userState }));
vi.mock('@/server/entity-route-access', () => ({
  entityRouteAccessFn: (...args: unknown[]) => state.routeAccess(...args),
}));
vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => state.recoveryDraft,
}));
vi.mock('@/features/auth/logic/routeVisibilityAccess', () => ({
  resolveRouteVisibilityAccess: () => state.visibilityDecision,
}));

import { useForgotPasswordFormController } from '../useForgotPasswordFormController';
import { useResetPasswordFormController } from '../useResetPasswordFormController';
import { useGoogleAuth } from '../useGoogleAuth';
import { useUser } from '../useUser';
import { useEntityRouteAccess } from '../useEntityRouteAccess';
import { useEntityVisibilityGuardController } from '../useEntityVisibilityGuardController';

const submitEvent = () => ({ preventDefault: vi.fn() }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  state.search = {};
  state.authError = null;
  state.signingIn = false;
  state.passwordValid = false;
  state.passwordsEqual = false;
  state.auth = { user: null, loading: false, session: null };
  state.userState = { currentUser: null, isLoading: false };
  state.recoveryDraft = null;
  state.visibilityDecision = { allowed: true };
  state.routeAccess.mockResolvedValue({
    exists: true,
    visibilities: ['public'],
    canAccessPrivate: false,
  });
  state.resetPassword.mockResolvedValue({ success: true });
  state.updateUser.mockResolvedValue({ error: null });
  state.signOut.mockResolvedValue(undefined);
  state.signInWithGoogle.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('password and identity controllers', () => {
  it('covers empty, successful and failed forgot-password submissions and navigation', async () => {
    state.search = { email: 'initial@example.test' };
    state.authError = 'global-error';
    const { result } = renderHook(() => useForgotPasswordFormController());
    expect(result.current.email).toBe('initial@example.test');
    expect(result.current.displayError).toBe('global-error');
    expect(result.current.copy.title).toBe('auth.forgotPassword.title');

    act(() => result.current.onEmailChange(''));
    await act(() => result.current.onSubmit(submitEvent()));
    expect(state.resetPassword).not.toHaveBeenCalled();

    act(() => result.current.onEmailChange('person@example.test'));
    await act(() => result.current.onSubmit(submitEvent()));
    expect(result.current.sent).toBe(true);

    state.resetPassword.mockResolvedValueOnce({ success: false, error: 'rejected' });
    await act(() => result.current.onSubmit(submitEvent()));
    expect(result.current.displayError).toBe('rejected');
    act(() => result.current.onBackToSignIn());
    expect(state.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' });
  });

  it('uses empty search/error fallbacks in forgot-password state', async () => {
    state.resetPassword.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useForgotPasswordFormController());
    expect(result.current.email).toBe('');
    expect(result.current.displayError).toBeNull();
    act(() => result.current.onEmailChange('person@example.test'));
    await act(() => result.current.onSubmit(submitEvent()));
    expect(result.current.displayError).toBeNull();
  });

  it('validates reset passwords and handles success and provider failure', async () => {
    const { result } = renderHook(() => useResetPasswordFormController());
    await act(() => result.current.onSubmit(submitEvent()));
    expect(result.current.error).toBe('auth.resetPassword.tooShort');

    state.passwordValid = true;
    act(() => {
      result.current.onPasswordChange('long-password');
      result.current.onConfirmPasswordChange('different');
    });
    await act(() => result.current.onSubmit(submitEvent()));
    expect(result.current.error).toBe('auth.resetPassword.mismatch');

    state.passwordsEqual = true;
    act(() => result.current.onConfirmPasswordChange('long-password'));
    await act(() => result.current.onSubmit(submitEvent()));
    expect(state.signOut).toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in', replace: true });
    expect(result.current.isSubmitting).toBe(false);

    state.updateUser.mockResolvedValueOnce({ error: new Error('provider') });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(() => result.current.onSubmit(submitEvent()));
    expect(result.current.error).toBe('auth.resetPassword.failed');
    expect(consoleError).toHaveBeenCalled();
  });

  it('returns every Google-auth outcome and clears redirecting state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useGoogleAuth());
    await expect(act(() => result.current.continueWithGoogle('sign-in'))).resolves.toBe(true);
    state.signInWithGoogle.mockResolvedValueOnce(false);
    await expect(act(() => result.current.continueWithGoogle('sign-up'))).resolves.toBe(false);
    state.signInWithGoogle.mockRejectedValueOnce(new Error('oauth'));
    await expect(act(() => result.current.continueWithGoogle('sign-in'))).resolves.toBe(false);
    expect(result.current.isRedirecting).toBe(false);
    expect(state.toastError).toHaveBeenCalledWith('features.auth.errors.unexpectedError');
    expect(consoleError).toHaveBeenCalled();
  });

  it('combines auth and Zero user loading/fallback states', () => {
    state.auth = { user: { id: 'auth-user' }, loading: true, session: null };
    state.userState = { currentUser: null, isLoading: false };
    const { result, rerender } = renderHook(() => useUser());
    expect(result.current).toMatchObject({
      user: { id: 'auth-user' },
      isLoading: true,
      error: null,
    });

    state.auth = { user: { id: 'auth-user' }, loading: false, session: null };
    state.userState = { currentUser: { id: 'zero-user' }, isLoading: true };
    rerender();
    expect(result.current).toMatchObject({ user: { id: 'zero-user' }, isLoading: true });

    state.auth = { user: null, loading: false, session: null };
    rerender();
    expect(result.current).toMatchObject({ user: { id: 'zero-user' }, isLoading: false });
  });
});

describe('entity access controllers', () => {
  it('resolves supported and unsupported entity types and normal success/error states', async () => {
    for (const entityType of ['group', 'event', 'amendment', 'blog', 'user'] as const) {
      const hook = renderHook(() =>
        useEntityRouteAccess({ entityType, entityId: `id-${entityType}` } as never)
      );
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      expect(hook.result.current.data?.exists).toBe(true);
      hook.unmount();
    }

    state.routeAccess.mockRejectedValueOnce('non-error');
    const failed = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'failed' })
    );
    await waitFor(() =>
      expect(failed.result.current.error?.message).toBe('Failed to resolve route access')
    );

    state.routeAccess.mockRejectedValueOnce(new Error('typed-error'));
    const typedFailure = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'typed-failure' })
    );
    await waitFor(() => expect(typedFailure.result.current.error?.message).toBe('typed-error'));
  });

  it('ignores stale success and error promises after cleanup', async () => {
    let resolveSuccess!: (value: any) => void;
    state.routeAccess.mockReturnValueOnce(
      new Promise(resolve => {
        resolveSuccess = resolve;
      })
    );
    const success = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'stale-success' })
    );
    success.unmount();
    await act(async () =>
      resolveSuccess({ exists: true, visibilities: [], canAccessPrivate: false })
    );

    let rejectFailure!: (value: unknown) => void;
    state.routeAccess.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFailure = reject;
      })
    );
    const failure = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'stale-error' })
    );
    failure.unmount();
    await act(async () => rejectFailure(new Error('ignored')));
  });

  it('exposes a pending create only while the server has not found the entity', async () => {
    state.recoveryDraft = { status: 'pending', submittedAt: 1 };
    state.routeAccess.mockResolvedValueOnce({
      exists: false,
      visibilities: [],
      canAccessPrivate: false,
    });
    const pending = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'pending' })
    );
    await waitFor(() => expect(pending.result.current.isLoading).toBe(false));
    expect(pending.result.current.data).toMatchObject({
      exists: true,
      canAccessPrivate: true,
    });
    pending.unmount();

    state.routeAccess.mockResolvedValueOnce({
      exists: true,
      visibilities: ['public'],
      canAccessPrivate: false,
    });
    const existing = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'existing' })
    );
    await waitFor(() => expect(existing.result.current.data?.visibilities).toEqual(['public']));
  });

  it('returns every visibility state, including both denial reasons', () => {
    const options = {
      entityExists: true,
      hasError: false,
      isLoading: false,
      visibilities: [],
      canAccessPrivate: false,
    } as const;
    const hook = renderHook((props: any) => useEntityVisibilityGuardController(props), {
      initialProps: { ...options, recoveryDraft: { status: 'failed' }, entityExists: false },
    });
    expect(hook.result.current.state).toBe('recovery');
    hook.rerender({ ...options, recoveryDraft: { status: 'pending' }, entityExists: false } as any);
    expect(hook.result.current.state).toBe('not-found');
    hook.rerender({ ...options, isLoading: true } as any);
    expect(hook.result.current.state).toBe('loading');
    hook.rerender({ ...options, hasError: true } as any);
    expect(hook.result.current.state).toBe('error');

    state.visibilityDecision = { allowed: false };
    hook.rerender(options as any);
    expect(hook.result.current).toEqual({ state: 'unauthorized', reason: 'login-required' });
    state.visibilityDecision = { allowed: false, reason: 'private' };
    hook.rerender(options as any);
    expect(hook.result.current).toEqual({ state: 'unauthorized', reason: 'private' });
    state.visibilityDecision = { allowed: true };
    hook.rerender(options as any);
    expect(hook.result.current.state).toBe('allowed');
  });
});
