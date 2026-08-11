/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthCallbackPage } from '../ui/AuthCallbackPage';
import { ForgotPasswordForm } from '../ui/ForgotPasswordForm';
import { ResetPasswordForm } from '../ui/ResetPasswordForm';
import { renderComponentFlow } from '@/test/render-component-flow';

const recovery = vi.hoisted(() => ({
  clearError: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  navigate: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
  toastError: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => recovery.navigate,
  useSearch: () => ({}),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({ error: null, clearError: recovery.clearError }),
}));

vi.mock('../hooks/useAuthSignIn', () => ({
  useAuthSignIn: () => ({ isSigningIn: false, resetPassword: recovery.resetPassword }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: recovery.exchangeCodeForSession,
      getUser: recovery.getUser,
      signOut: recovery.signOut,
      updateUser: recovery.updateUser,
    },
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: recovery.toastError },
}));

vi.mock('@/features/shared/ui/feedback', async importOriginal => {
  const original = await importOriginal<any>();
  return {
    ...original,
    AppBootLoadingState: ({ details }: { details: string }) => <div role="status">{details}</div>,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  recovery.resetPassword.mockResolvedValue({ success: true });
  recovery.exchangeCodeForSession.mockResolvedValue({ error: null });
  recovery.getUser.mockResolvedValue({ data: { user: null } });
  recovery.updateUser.mockResolvedValue({ error: null });
  recovery.signOut.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe('account recovery flow', () => {
  it('requests a password reset and replaces the form with its sent state', async () => {
    renderComponentFlow(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/auth\.forgotPassword\.emailLabel/);
    fireEvent.change(email, {
      target: { value: 'ada@example.test' },
    });
    fireEvent.submit(email.closest('form') as HTMLFormElement);

    await screen.findByText('auth.forgotPassword.successTitle');
    expect(screen.getByText('ada@example.test')).toBeTruthy();
    expect(recovery.resetPassword).toHaveBeenCalledWith('ada@example.test');
  });

  it('rejects an expired callback and returns to sign-in without using an unsafe redirect', async () => {
    recovery.exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired code' } });
    renderComponentFlow(<AuthCallbackPage />, {
      initialUrl: '/auth/callback?code=expired&next=https://attacker.invalid/path',
    });

    await waitFor(() => expect(recovery.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' }), {
      timeout: 2_000,
    });
    expect(recovery.toastError).toHaveBeenCalledWith('auth.callback.failed');
    expect(recovery.navigate).not.toHaveBeenCalledWith({ to: 'https://attacker.invalid/path' });
  });

  it('updates a valid password, ends the recovery session and exposes navigation status', async () => {
    renderComponentFlow(<ResetPasswordForm />);
    const password = screen.getByLabelText(/auth\.resetPassword\.newPassword/);
    const confirmation = screen.getByLabelText(/auth\.resetPassword\.confirmPassword/);
    fireEvent.change(password, {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(confirmation, {
      target: { value: 'new-password-123' },
    });
    fireEvent.submit(password.closest('form') as HTMLFormElement);

    await waitFor(() =>
      expect(recovery.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' })
    );
    expect(recovery.signOut).toHaveBeenCalledTimes(1);
    expect(recovery.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in', replace: true });
  });
});
