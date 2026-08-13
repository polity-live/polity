/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountPasswordSection } from '@/features/users/ui/AccountPasswordSection';
import { renderComponentFlow } from '@/test/render-component-flow';

const account = vi.hoisted(() => ({
  reauthenticate: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'account-user',
      email: 'person@example.test',
      hasPassword: true,
    },
    authStateLoading: false,
    refreshAuthState: vi.fn(),
    signOut: account.signOut,
  }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      reauthenticate: account.reauthenticate,
      signInWithPassword: account.signInWithPassword,
      updateUser: account.updateUser,
    },
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function fillNewPassword() {
  fireEvent.change(screen.getByLabelText(/pages\.user\.accountPassword\.newPassword/), {
    target: { value: 'new-secure-password' },
  });
  fireEvent.change(screen.getByLabelText(/pages\.user\.accountPassword\.confirmPassword/), {
    target: { value: 'new-secure-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'pages.user.accountPassword.update' }));
}

async function requestVerificationCode() {
  fillNewPassword();
  const currentPassword = await screen.findByLabelText(
    'pages.user.securityConfirmation.currentPassword'
  );
  fireEvent.change(currentPassword, { target: { value: 'current-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'pages.user.securityConfirmation.confirm' }));
  return screen.findByLabelText('pages.user.securityConfirmation.codeLabel');
}

beforeEach(() => {
  vi.clearAllMocks();
  account.signInWithPassword.mockResolvedValue({ error: null });
  account.reauthenticate.mockResolvedValue({ error: null });
  account.updateUser.mockResolvedValue({ error: null });
  account.signOut.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('account password security flow', () => {
  it('uses the real password section to reach reauthentication and the nonce step', async () => {
    renderComponentFlow(<AccountPasswordSection />);
    await requestVerificationCode();

    expect(account.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'current-password',
    });
    expect(account.reauthenticate).toHaveBeenCalledOnce();
    expect(account.updateUser).not.toHaveBeenCalled();
  });

  it('updates with the verification nonce and globally signs out the current client', async () => {
    renderComponentFlow(<AccountPasswordSection />);
    const code = await requestVerificationCode();
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'pages.user.securityConfirmation.confirm' })
    );

    await waitFor(() => expect(account.signOut).toHaveBeenCalledOnce());
    expect(account.updateUser).toHaveBeenCalledWith({
      password: 'new-secure-password',
      nonce: '123456',
      current_password: 'current-password',
    });
  });

  it('keeps the session and exposes the provider error when the update fails', async () => {
    account.updateUser.mockResolvedValue({ error: new Error('provider rejected update') });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderComponentFlow(<AccountPasswordSection />);
    const code = await requestVerificationCode();
    fireEvent.change(code, { target: { value: '654321' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'pages.user.securityConfirmation.confirm' })
    );

    await screen.findByText('pages.user.accountPassword.failed');
    expect(account.signOut).not.toHaveBeenCalled();
    expect(screen.getByLabelText('pages.user.securityConfirmation.codeLabel')).toBeTruthy();
  });
});
