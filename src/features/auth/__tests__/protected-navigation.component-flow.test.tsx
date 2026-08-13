/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../AuthGuard';
import { PermissionGuard } from '../PermissionGuard';
import { SignInForm } from '../ui/SignInForm';
import { renderComponentFlow } from '@/test/render-component-flow';

const navigation = vi.hoisted(() => ({
  can: vi.fn(),
  isLoading: false,
  navigate: vi.fn(),
  user: null as null | { id: string },
  signIn: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: navigation.user, loading: false }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ can: navigation.can, isLoading: navigation.isLoading }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useLocation: () => ({
    pathname: window.location.pathname,
    searchStr: window.location.search,
    hash: window.location.hash,
  }),
  useNavigate: () => navigation.navigate,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../auth', () => ({
  useAuthStore: () => ({ error: null, clearError: vi.fn() }),
}));
vi.mock('../hooks/useAuthSignIn', () => ({
  useAuthSignIn: () => ({
    isSigningIn: false,
    signIn: navigation.signIn,
    sendMagicLink: vi.fn(),
  }),
}));
vi.mock('../hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({ isRedirecting: false, continueWithGoogle: vi.fn() }),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: () => <div role="status">auth-loading</div>,
  SectionSkeleton: () => <div role="status">permission-loading</div>,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.sessionStorage.clear();
  navigation.user = null;
  navigation.isLoading = false;
  navigation.can.mockReturnValue(false);
  navigation.signIn.mockResolvedValue({ success: true, isNewUser: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('protected navigation flow', () => {
  it('keeps path, query and hash in both the login redirect and pending target', async () => {
    renderComponentFlow(<AuthGuard fallback="sign-in-required">settings</AuthGuard>, {
      initialUrl: '/group/abc/settings?tab=members#roles',
    });
    await act(async () => undefined);
    await act(async () => vi.advanceTimersByTime(100));

    expect(navigation.navigate).toHaveBeenCalledWith({
      to: '/auth?redirect=%2Fgroup%2Fabc%2Fsettings%3Ftab%3Dmembers%23roles',
    });
    expect(sessionStorage.getItem('polity_pending_sign_in_redirect')).toBe(
      '/group/abc/settings?tab=members#roles'
    );
  });

  it('renders the permission error surface after authorization completes', () => {
    renderComponentFlow(
      <PermissionGuard action={'update' as any} resource={'group' as any} context={{} as any}>
        protected-settings
      </PermissionGuard>
    );

    expect(screen.getByText('errors.accessDenied.title')).toBeTruthy();
    expect(screen.queryByText('protected-settings')).toBeNull();
  });

  it('consumes the guard target through the real sign-in controller and rejects external targets', async () => {
    const guard = renderComponentFlow(<AuthGuard fallback="sign-in-required">settings</AuthGuard>, {
      initialUrl: '/event/abc/agenda?mode=live#speaker-queue',
    });
    await act(async () => vi.advanceTimersByTime(100));
    guard.unmount();

    const login = renderComponentFlow(<SignInForm />);
    fireEvent.change(screen.getByLabelText(/auth\.signIn\.emailLabel/), {
      target: { value: 'person@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/auth\.signIn\.passwordLabel/), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn.submit' }));
    await act(async () => undefined);
    expect(navigation.navigate).toHaveBeenLastCalledWith({
      to: '/event/abc/agenda?mode=live#speaker-queue',
    });

    login.unmount();
    sessionStorage.setItem('polity_pending_sign_in_redirect', 'https://attacker.invalid/capture');
    renderComponentFlow(<SignInForm />);
    fireEvent.change(screen.getByLabelText(/auth\.signIn\.emailLabel/), {
      target: { value: 'person@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/auth\.signIn\.passwordLabel/), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn.submit' }));
    await act(async () => undefined);
    expect(navigation.navigate).toHaveBeenLastCalledWith({ to: '/' });
  });
});
