/* @vitest-environment jsdom */

import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../AuthGuard';
import { PermissionGuard } from '../PermissionGuard';
import { getSafeSignInRedirect } from '../logic/authRedirects';
import { renderComponentFlow } from '@/test/render-component-flow';

const navigation = vi.hoisted(() => ({
  can: vi.fn(),
  isLoading: false,
  navigate: vi.fn(),
  user: null as null | { id: string },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: navigation.user, loading: false }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ can: navigation.can, isLoading: navigation.isLoading }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: window.location.pathname }),
  useNavigate: () => navigation.navigate,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: () => <div role="status">auth-loading</div>,
  SectionSkeleton: () => <div role="status">permission-loading</div>,
}));

function LoginReturn({ next }: { next: string }) {
  const destination = getSafeSignInRedirect(next);
  return (
    <button type="button" onClick={() => navigation.navigate({ to: destination })}>
      finish-login
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.sessionStorage.clear();
  navigation.user = null;
  navigation.isLoading = false;
  navigation.can.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('protected navigation flow', () => {
  it('keeps the complete protected deep-link pathname in the login redirect', async () => {
    renderComponentFlow(<AuthGuard fallback="sign-in-required">settings</AuthGuard>, {
      initialUrl: '/group/abc/settings?tab=members',
    });
    await act(async () => undefined);
    await act(async () => vi.advanceTimersByTime(100));

    expect(navigation.navigate).toHaveBeenCalledWith({
      to: '/auth?redirect=%2Fgroup%2Fabc%2Fsettings',
    });
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

  it('returns to the original internal target after login and rejects external targets', () => {
    const view = renderComponentFlow(<LoginReturn next="/event/abc/agenda?mode=live" />);
    screen.getByRole('button', { name: 'finish-login' }).click();
    expect(navigation.navigate).toHaveBeenLastCalledWith({
      to: '/event/abc/agenda?mode=live',
    });

    view.rerender(<LoginReturn next="https://attacker.invalid/capture" />);
    screen.getByRole('button', { name: 'finish-login' }).click();
    expect(navigation.navigate).toHaveBeenLastCalledWith({ to: '/' });
  });
});
