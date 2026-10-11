/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  request: vi.fn(),
  navigate: vi.fn(),
  signOut: vi.fn(),
  loading: false,
  language: 'en',
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut, loading: mocks.loading }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: mocks.language }),
}));
vi.mock('../../hooks/useEmailInvitationComposer', () => ({
  emailInvitationRequest: mocks.request,
  EmailInvitationApiError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));
import { EmailInvitationApiError } from '../../hooks/useEmailInvitationComposer';
import { GroupInvitationPage } from '../GroupInvitationPage';
const token = 'a'.repeat(43);
const preview = {
  groupName: 'New group',
  inviterName: 'Admin',
  maskedEmail: 'r***@example.com',
  roles: ['Member'],
  state: 'pending',
  matchesEmail: true,
  emailConfirmed: true,
};
beforeEach(() => {
  mocks.user = null;
  mocks.loading = false;
  mocks.language = 'en';
  mocks.request.mockReset().mockResolvedValue(preview);
  mocks.navigate.mockReset();
  mocks.signOut.mockReset().mockResolvedValue(undefined);
  sessionStorage.clear();
});
afterEach(cleanup);
it.each([true, false])(
  'shows public loading failures without disclosing invite data, typed=%s',
  async typed => {
    mocks.request.mockRejectedValueOnce(
      typed ? new EmailInvitationApiError('not_found') : new Error('offline')
    );
    render(<GroupInvitationPage token={token} />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      typed ? 'not_found' : 'server_error'
    );
    expect(screen.queryByRole('button', { name: /accept$/ })).toBeNull();
  }
);
it.each(['en', 'de'])(
  'shows expiry and requires a confirmed account before acceptance in %s',
  async language => {
    mocks.language = language;
    mocks.user = { id: 'recipient' };
    mocks.request.mockResolvedValue({
      ...preview,
      emailConfirmed: false,
      expiresAt: '2026-10-15T12:00:00Z',
    });
    render(<GroupInvitationPage token={token} />);
    await screen.findByText(/confirmEmail$/);
    expect(screen.getByText(/expires$/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /accept$/ })).toBeNull();
  }
);
it('waits for authentication before loading the invitation and routes an onboarded account directly to its group', async () => {
  mocks.loading = true;
  const view = render(<GroupInvitationPage token={token} />);
  expect(mocks.request).not.toHaveBeenCalled();
  mocks.loading = false;
  mocks.user = { id: 'recipient' };
  mocks.request
    .mockResolvedValueOnce(preview)
    .mockResolvedValueOnce({ groupId: 'group', needsOnboarding: false });
  view.rerender(<GroupInvitationPage token={token} />);
  fireEvent.click(await screen.findByRole('button', { name: /accept$/ }));
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/group/$id',
      params: { id: 'group' },
      replace: true,
    })
  );
});
it('keeps a pending onboarding session and reports unexpected acceptance failures', async () => {
  mocks.user = { id: 'recipient' };
  sessionStorage.setItem('polity_onboarding', 'true');
  mocks.request
    .mockResolvedValueOnce(preview)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ groupId: 'group', needsOnboarding: false });
  render(<GroupInvitationPage token={token} />);
  fireEvent.click(await screen.findByRole('button', { name: /accept$/ }));
  expect((await screen.findByRole('alert')).textContent).toContain('server_error');
  fireEvent.click(screen.getByRole('button', { name: /accept$/ }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true }));
});
it('shows only the masked recipient and preserves the personal link through registration', async () => {
  render(<GroupInvitationPage token={token} />);
  await screen.findByText(/r\*\*\*@example.com/);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  const signup = screen.getByRole('button', { name: /signUp$/ });
  signup.focus();
  expect(document.activeElement).toBe(signup);
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/auth/sign-up' }));
  expect(sessionStorage.getItem('polity_pending_sign_in_redirect')).toBe(`/invite/${token}`);
  const signin = screen.getByRole('button', { name: /signIn$/ });
  signin.focus();
  await userEvent.keyboard('{Enter}');
  expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/auth/sign-in' });
});
it('disables acceptance while awaiting the server and displays revoked permissions without joining', async () => {
  mocks.user = { id: 'recipient' };
  let reject: (error: Error) => void = () => undefined;
  mocks.request.mockResolvedValueOnce(preview).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  render(<GroupInvitationPage token={token} />);
  const accept = await screen.findByRole('button', { name: /accept$/ });
  accept.focus();
  await userEvent.keyboard('{Enter}');
  expect((accept as HTMLButtonElement).disabled).toBe(true);
  reject(new EmailInvitationApiError('permission_denied'));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toContain('permission_denied');
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it('requires explicit acceptance and returns a new account to onboarding with its group destination', async () => {
  mocks.user = { id: 'recipient' };
  mocks.request
    .mockResolvedValueOnce(preview)
    .mockResolvedValueOnce({ groupId: 'group', needsOnboarding: true });
  render(<GroupInvitationPage token={token} />);
  const accept = await screen.findByRole('button', { name: /accept$/ });
  expect(mocks.request).toHaveBeenCalledTimes(1);
  fireEvent.click(accept);
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true }));
  expect(mocks.request).toHaveBeenLastCalledWith(`/api/invitations/${token}`, {});
  expect(sessionStorage.getItem('polity_onboarding')).toBe('true');
  expect(sessionStorage.getItem('polity_invitation_onboarding_destination')).toBe('/group/group');
});
it('offers account switching for a mismatch and hides acceptance for expired links', async () => {
  mocks.user = { id: 'wrong' };
  mocks.request.mockResolvedValue({ ...preview, matchesEmail: false });
  const view = render(<GroupInvitationPage token={token} />);
  fireEvent.click(await screen.findByRole('button', { name: /switchAccount$/ }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  expect(sessionStorage.getItem('polity_pending_sign_in_redirect')).toBe(`/invite/${token}`);
  view.unmount();
  mocks.request.mockResolvedValue({ ...preview, state: 'expired' });
  render(<GroupInvitationPage token={'b'.repeat(43)} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: /accept$/ })).toBeNull();
});
