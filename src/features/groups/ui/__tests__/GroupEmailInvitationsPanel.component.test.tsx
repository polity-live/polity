/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
const request = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useEmailInvitationComposer', () => ({
  emailInvitationRequest: request,
  EmailInvitationApiError: class extends Error {},
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
  translate: (key: string) => key,
}));
import { GroupEmailInvitationsPanel } from '../GroupEmailInvitationsPanel';

it('uses the shared member-table layout with named recipients, role tags, status badges and icon actions', async () => {
  const common = { role_names: ['Member', 'Editor'], last_attempt_at: null, expires_at: null };
  request.mockResolvedValue({
    invitations: [
      {
        ...common,
        id: 'named',
        email: 'ada@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        state: 'pending',
        delivery_status: 'sent',
      },
      {
        ...common,
        id: 'unnamed',
        email: 'no-name@example.com',
        state: 'expired',
        delivery_status: 'unknown',
      },
      {
        ...common,
        id: 'accepted',
        email: 'accepted@example.com',
        first_name: 'Grace',
        state: 'accepted',
        delivery_status: 'delivered',
      },
      {
        ...common,
        id: 'revoked',
        email: 'revoked@example.com',
        state: 'revoked',
        delivery_status: 'bounced',
      },
    ],
  });
  const view = render(<GroupEmailInvitationsPanel groupId="group" />);
  await screen.findByText('Ada Lovelace');
  expect(screen.getByRole('heading', { name: /title.*4/ })).toBeTruthy();
  expect(view.container.querySelector('[data-slot="management-section"]')).toBeTruthy();
  expect(
    view.container.querySelector('[data-slot="data-table-surface"]')?.getAttribute('data-surface')
  ).toBe('standalone');
  expect(screen.getAllByRole('columnheader')).toHaveLength(6);
  expect(screen.getByRole('columnheader', { name: /actions$/ }).className).toContain('text-right');
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getAllByText('no-name@example.com')).toHaveLength(1);
  expect(screen.getByText('Grace')).toBeTruthy();
  const named = screen.getByText('ada@example.com').closest('tr')!;
  expect(within(named).getByText('Member').getAttribute('data-role-key')).toBe('Member');
  expect(within(named).getByText(/states.pending$/).className).toContain('--badge-info-bg');
  expect(within(named).getByText(/results.sent$/).className).toContain('--badge-success-bg');
  const unknown = screen.getByText('no-name@example.com').closest('tr')!;
  expect(within(unknown).getByText(/results.unknown$/).className).toContain('--badge-warning-bg');
  const revoked = screen.getByText('revoked@example.com').closest('tr')!;
  expect(within(revoked).getByText(/results.bounced$/).className).toContain('--badge-danger-bg');
  expect(within(revoked).queryByRole('button', { name: /revoke$/ })).toBeNull();
  const resend = within(named).getByRole('button', { name: /resend$/ });
  expect(resend.textContent).toBe('');
  expect(resend.querySelector('svg')).toBeTruthy();
  expect(within(named).getByRole('button', { name: /revoke$/ }).className).toContain(
    'text-destructive'
  );
  expect(screen.queryByRole('button', { name: /Next|Previous/ })).toBeNull();
});
afterEach(() => {
  cleanup();
  request.mockReset();
});
it('offers a keyboard retry after an unauthorized list response and recovers without stale rows', async () => {
  request.mockRejectedValueOnce(new Error('unauthorized')).mockResolvedValue({ invitations: [] });
  render(<GroupEmailInvitationsPanel groupId="group" />);
  const retry = await screen.findByRole('button', { name: /retry$/ });
  retry.focus();
  expect(document.activeElement).toBe(retry);
  await userEvent.keyboard('{Enter}');
  await screen.findByText(/noInvitations$/);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('lists email and delivery states, enforces resend cooldown and manages pending invitations', async () => {
  const row = {
    id: 'invitation',
    email: 'r@example.com',
    role_names: ['Member'],
    state: 'pending',
    delivery_status: 'sent',
    last_attempt_at: new Date().toISOString(),
    expires_at: new Date().toISOString(),
  };
  request.mockResolvedValue({ invitations: [row] });
  const view = render(<GroupEmailInvitationsPanel groupId="group" />);
  await screen.findByText(row.email);
  expect((screen.getByRole('button', { name: /resend$/ }) as HTMLButtonElement).disabled).toBe(
    true
  );
  fireEvent.click(screen.getByRole('button', { name: /revoke$/ }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/groups/group/email-invitations',
      expect.objectContaining({ action: 'revoke', invitationId: row.id })
    )
  );
  view.unmount();
  request.mockResolvedValue({
    invitations: [{ ...row, last_attempt_at: new Date(Date.now() - 660_000).toISOString() }],
  });
  render(<GroupEmailInvitationsPanel groupId="group" />);
  fireEvent.click(await screen.findByRole('button', { name: /resend$/ }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/groups/group/email-invitations',
      expect.objectContaining({ action: 'resend' })
    )
  );
});
