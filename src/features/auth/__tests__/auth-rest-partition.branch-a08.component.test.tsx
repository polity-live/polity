/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authGuard: vi.fn(),
  permissionGuard: vi.fn(),
  verifyMagicCode: vi.fn(),
  getUser: vi.fn(),
  toastError: vi.fn(),
  navigate: vi.fn(),
  sendMagicLink: vi.fn(),
  authError: null as string | null,
  authUser: null as null | { id: string },
}));

vi.mock('../hooks/useAuthGuardController', () => ({
  useAuthGuardController: (...args: unknown[]) => state.authGuard(...args),
}));
vi.mock('../AuthGuardView', () => ({
  AuthGuardView: ({ children, ...props }: any) => (
    <div data-testid="auth-guard-view" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));
vi.mock('../usePermissionGuardController', () => ({
  usePermissionGuardController: (...args: unknown[]) => state.permissionGuard(...args),
}));
vi.mock('../PermissionGuardView', () => ({
  PermissionGuardView: (props: any) => <div data-testid="permission-view">{props.children}</div>,
}));
vi.mock('@/features/auth/ui/AccessDenied.tsx', () => ({
  AccessDenied: () => <span>default-denied</span>,
}));
vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({ error: state.authError, verifyMagicCode: state.verifyMagicCode }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: state.getUser } }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: state.toastError } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => state.navigate }));
vi.mock('../hooks/useAuthLogin', () => ({
  useAuthLogin: () => ({ isSending: false, sendMagicLink: state.sendMagicLink }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: state.authUser }) }));
vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: ({ details }: any) => <div>loading:{details}</div>,
}));

import { AuthGuard, withAuth, withoutAuth } from '../AuthGuard';
import { EnsureUserView } from '../EnsureUserView';
import { PermissionGuard } from '../PermissionGuard';
import { useAuthVerification } from '../hooks/useAuthVerification';
import { useLoginFormController } from '../hooks/useLoginFormController';
import { useRequiredUser } from '../hooks/useRequiredUser';

beforeEach(() => {
  vi.clearAllMocks();
  state.authGuard.mockReturnValue({ isReady: true, isAllowed: true });
  state.permissionGuard.mockImplementation((props: any) => ({
    ...props,
    can: () => true,
    isLoading: false,
  }));
  state.verifyMagicCode.mockResolvedValue(true);
  state.getUser.mockResolvedValue({
    data: { user: { id: 'user', created_at: new Date().toISOString() } },
  });
  state.sendMagicLink.mockResolvedValue({ success: true });
  state.authError = null;
  state.authUser = null;
});

afterEach(cleanup);

describe('auth wrappers and readiness', () => {
  it('covers AuthGuard defaults, explicit public access and both HOCs', () => {
    const view = render(<AuthGuard>private</AuthGuard>);
    expect(state.authGuard).toHaveBeenLastCalledWith({ requireAuth: true, redirectTo: undefined });
    view.rerender(
      <AuthGuard requireAuth={false} redirectTo="/home">
        public
      </AuthGuard>
    );
    expect(state.authGuard).toHaveBeenLastCalledWith({ requireAuth: false, redirectTo: '/home' });

    const Page = ({ label }: { label: string }) => <span>{label}</span>;
    const PrivatePage = withAuth(Page, { redirectTo: '/login' });
    const PublicPage = withoutAuth(Page);
    view.rerender(<PrivatePage label="private-page" />);
    expect(screen.getByText('private-page')).toBeTruthy();
    view.rerender(<PublicPage label="public-page" />);
    expect(screen.getByText('public-page')).toBeTruthy();
  });

  it('uses explicit and default permission fallbacks', () => {
    const common = { action: 'read', resource: 'group', context: {} } as any;
    const view = render(<PermissionGuard {...common}>allowed</PermissionGuard>);
    expect(state.permissionGuard.mock.calls.at(-1)?.[0].fallback).toBeTruthy();
    view.rerender(
      <PermissionGuard {...common} fallback={<span>custom-denied</span>}>
        allowed
      </PermissionGuard>
    );
    expect(state.permissionGuard.mock.calls.at(-1)?.[0].fallback.props.children).toBe(
      'custom-denied'
    );
  });

  it('renders loading, missing-user and ready EnsureUser states', () => {
    const common = {
      zeroConnectionState: 'connected',
      connectionStatus: 'syncing' as const,
      retry: vi.fn(),
      signOut: vi.fn(),
    };
    const view = render(
      <EnsureUserView {...common} isLoading hasUser={false}>
        app
      </EnsureUserView>
    );
    expect(screen.getByText('loading:syncing')).toBeTruthy();
    view.rerender(
      <EnsureUserView {...common} isLoading={false} hasUser={false}>
        app
      </EnsureUserView>
    );
    expect(view.container.textContent).toBe('');
    view.rerender(
      <EnsureUserView {...common} isLoading={false} hasUser>
        app
      </EnsureUserView>
    );
    expect(screen.getByText('app')).toBeTruthy();
  });
});

describe('auth hooks', () => {
  it('covers invalid code, missing user, old/new user and unexpected verification errors', async () => {
    const { result } = renderHook(() => useAuthVerification());
    state.verifyMagicCode.mockResolvedValueOnce(false);
    await expect(
      act(() => result.current.verifyAndInitialize('a@b.test', '111111'))
    ).resolves.toMatchObject({
      success: false,
      error: 'features.auth.errors.invalidOrExpiredCode',
    });

    state.getUser.mockResolvedValueOnce({ data: { user: null } });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      act(() => result.current.verifyAndInitialize('a@b.test', '222222'))
    ).resolves.toMatchObject({
      success: false,
      error: 'features.auth.errors.authenticationFailed',
    });

    state.getUser.mockResolvedValueOnce({
      data: { user: { id: 'old', created_at: new Date(Date.now() - 600_000).toISOString() } },
    });
    await expect(
      act(() => result.current.verifyAndInitialize('a@b.test', '333333'))
    ).resolves.toEqual({ success: true, isNewUser: false });
    state.getUser.mockResolvedValueOnce({
      data: { user: { id: 'new', created_at: new Date().toISOString() } },
    });
    await expect(
      act(() => result.current.verifyAndInitialize('a@b.test', '444444'))
    ).resolves.toEqual({ success: true, isNewUser: true });

    state.verifyMagicCode.mockRejectedValueOnce(new Error('provider'));
    await expect(
      act(() => result.current.verifyAndInitialize('a@b.test', '555555'))
    ).resolves.toMatchObject({ success: false, error: 'features.auth.errors.unexpectedError' });
    expect(state.toastError).toHaveBeenCalled();
    expect(result.current.isVerifying).toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });

  it('guards empty login submission and navigates only after success', async () => {
    const { result } = renderHook(() => useLoginFormController());
    const event = { preventDefault: vi.fn() } as never;
    await act(() => result.current.onSubmit(event));
    expect(state.sendMagicLink).not.toHaveBeenCalled();
    act(() => result.current.onEmailChange('ada@example.test'));
    state.sendMagicLink.mockResolvedValueOnce({ success: false });
    await act(() => result.current.onSubmit(event));
    expect(state.navigate).not.toHaveBeenCalled();
    state.sendMagicLink.mockResolvedValueOnce({ success: true });
    await act(() => result.current.onSubmit(event));
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/auth/verify',
      search: { email: 'ada@example.test' },
    });
    expect(result.current.copy.title).toBe('auth.login.title');
  });

  it('throws without a required user and returns an authenticated one', () => {
    expect(() => renderHook(() => useRequiredUser())).toThrow(
      'useRequiredUser must be used inside EnsureUser'
    );
    state.authUser = { id: 'user' };
    const { result } = renderHook(() => useRequiredUser());
    expect(result.current.id).toBe('user');
  });
});
