/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Checking acceptance...')).not.toBeNull();
  });
});
