/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InvitationActionsView } from '../InvitationActionsView';

afterEach(cleanup);

describe('InvitationActionsView loading state', () => {
  it('shows acceptance preflight progress on the accept button', () => {
    render(
      <InvitationActionsView
        item={{ id: 'invitation-1' }}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        blocking={false}
        checking
        response={{ blocking: false, conflicts: [] }}
        labels={{
          accept: 'Accept',
          decline: 'Decline',
          why: 'Why?',
          checking: 'Checking acceptance...',
          blockedTitle: 'Blocked',
        }}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /Checking acceptance/ });

    expect(acceptButton.getAttribute('data-loading')).toBe('true');
    expect(acceptButton.getAttribute('data-action-id')).toBe('users.invitation.accept');
    expect(screen.getByText('Checking acceptance...')).not.toBeNull();
  });

  it('accepts and declines through stable invitation actions', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <InvitationActionsView
        item={{ id: 'invitation-1' }}
        onAccept={onAccept}
        onDecline={onDecline}
        blocking={false}
        response={{ blocking: false, conflicts: [] }}
        labels={{
          accept: 'Accept',
          decline: 'Decline',
          why: 'Why?',
          checking: 'Checking acceptance...',
          blockedTitle: 'Blocked',
        }}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="users.invitation.accept"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.invitation.decline"]')!);
    expect(onAccept).toHaveBeenCalledWith('invitation-1');
    expect(onDecline).toHaveBeenCalledWith('invitation-1');
  });
});
