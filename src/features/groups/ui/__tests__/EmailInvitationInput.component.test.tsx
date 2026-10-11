/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { EmailInvitationInput } from '../EmailInvitationInput';
import type { EmailInvitationComposer } from '../../hooks/useEmailInvitationComposer';

afterEach(cleanup);
it.each([
  ['sent', 'sendSuccess', 'status', 'success'],
  ['unknown', 'sendUnknown', 'alert', 'warning'],
  ['failed', 'sendFailed', 'alert', 'danger'],
] as const)(
  'shows a persistent %s result with the appropriate notice',
  (status, title, role, variant) => {
    const composer = {
      t: (key: string) => key,
      text: 'a@example.com',
      parsed: { emails: ['a@example.com'], invalid: [], duplicates: [] },
      recipients: [{ email: 'a@example.com' }],
      openInvitations: [],
      result: { available: 2, results: [{ email: 'a@example.com', status }] },
    } as unknown as EmailInvitationComposer;
    render(<EmailInvitationInput composer={composer} />);
    const banner = screen.getByTestId('email-invitation-send-result');
    expect(banner.getAttribute('role')).toBe(role);
    expect(banner.textContent).toContain(title);
    expect(banner.firstElementChild?.className).toContain(`--badge-${variant}-bg`);
  }
);
it('shows invalid entries, removed duplicates, skipped members and the exact quota before sending', () => {
  const setText = vi.fn();
  const composer = {
    t: (key: string, params?: Record<string, unknown>) =>
      key + (params ? JSON.stringify(params) : ''),
    text: 'a@example.com',
    setText,
    recipients: [{ email: 'a@example.com' }, { email: 'member@example.com' }],
    openInvitations: [],
    parsed: { emails: ['a@example.com'], invalid: ['invalid'], duplicates: ['a@example.com'] },
    readyCount: 2,
    preview: {
      available: 1,
      results: [
        { email: 'a@example.com', status: 'ready' },
        { email: 'member@example.com', status: 'member' },
      ],
    },
    checking: false,
    sending: false,
    error: '',
    result: null,
  } as unknown as EmailInvitationComposer;
  render(<EmailInvitationInput composer={composer} />);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.getByText(/duplicates/).textContent).toContain('a@example.com');
  expect(screen.getByText(/results.member/)).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: /addresses/ }), {
    target: { value: 'fixed@example.com' },
  });
  expect(setText).toHaveBeenCalledWith('fixed@example.com');
});
it('shows named cards, removes draft recipients and displays mixed sending results without claiming delivery', async () => {
  const removeRecipient = vi.fn(),
    setRecipientName = vi.fn(),
    startNewList = vi.fn();
  const composer = {
    t: (key: string, params?: object) => key + (params ? JSON.stringify(params) : ''),
    text: 'a@example.com',
    parsed: { emails: ['a@example.com'], invalid: [], duplicates: [] },
    recipients: [{ email: 'a@example.com', firstName: 'Ada', lastName: 'Lovelace' }],
    openInvitations: [
      {
        id: 'older',
        email: 'old@example.com',
        first_name: 'Grace',
        last_name: 'Hopper',
        delivery_status: 'sent',
      },
    ],
    removeRecipient,
    setRecipientName,
    startNewList,
    error: '',
    preview: null,
    result: null,
  } as unknown as EmailInvitationComposer;
  const view = render(<EmailInvitationInput composer={composer} />);
  expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  expect(screen.getByText('Grace Hopper')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: /firstName/ }), {
    target: { value: 'Augusta' },
  });
  expect(setRecipientName).toHaveBeenCalledWith('a@example.com', 'firstName', 'Augusta');
  fireEvent.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
  expect(removeRecipient).toHaveBeenCalledWith('a@example.com');
  view.rerender(
    <EmailInvitationInput
      composer={{
        ...composer,
        result: {
          available: 8,
          results: [
            { email: 'a@example.com', firstName: 'Ada', status: 'sent' },
            { email: 'b@example.com', status: 'failed' },
            { email: 'c@example.com', status: 'unknown' },
            { email: 'd@example.com', status: 'invited' },
          ],
        },
      }}
    />
  );
  const banner = screen.getByTestId('email-invitation-send-result');
  expect(banner.getAttribute('role')).toBe('alert');
  expect(banner.textContent).toContain('sendFailed');
  expect(banner.textContent).toContain('"success":1,"failed":1,"unknown":1,"skipped":1');
  expect(banner.textContent).toContain('providerAccepted');
  expect(screen.getByRole('textbox', { name: /addresses/ }).hasAttribute('disabled')).toBe(true);
  expect(screen.queryByRole('button', { name: /removeItem/ })).toBeNull();
  const next = screen.getByRole('button', { name: /morePeople/ });
  next.focus();
  expect(document.activeElement).toBe(next);
  await userEvent.keyboard('{Enter}');
  expect(startNewList).toHaveBeenCalledOnce();
});
it('offers keyboard retry for failed open-list loading and disables duplicate checks until completion', async () => {
  const refreshInvitations = vi.fn(async () => undefined);
  const composer = {
    t: (key: string) => key,
    text: '',
    parsed: { emails: [], invalid: [], duplicates: [] },
    recipients: [],
    openInvitations: [],
    listError: 'Permission denied',
    loadingInvitations: true,
    refreshInvitations,
  } as unknown as EmailInvitationComposer;
  const view = render(<EmailInvitationInput composer={composer} />);
  const retry = screen.getByRole('button', { name: /retry/ });
  expect(retry.hasAttribute('disabled')).toBe(true);
  fireEvent.click(retry);
  expect(refreshInvitations).not.toHaveBeenCalled();
  view.rerender(<EmailInvitationInput composer={{ ...composer, loadingInvitations: false }} />);
  retry.focus();
  expect(document.activeElement).toBe(retry);
  await userEvent.keyboard('{Enter}');
  expect(refreshInvitations).toHaveBeenCalledOnce();
  view.rerender(
    <EmailInvitationInput composer={{ ...composer, loadingInvitations: false, listError: '' }} />
  );
  expect(screen.queryByRole('alert')).toBeNull();
});
