/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { UserPlus } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MembershipButtonView } from '../MembershipButtonView';

afterEach(cleanup);

describe('MembershipButtonView loading state', () => {
  it('shows a loading label instead of silently disabling the action', () => {
    render(
      <MembershipButtonView
        isMember={false}
        hasRequested={false}
        isInvited={false}
        isLoading
        labels={{
          request: 'Request',
          leave: 'Leave',
          pending: 'Pending',
          accept: 'Accept',
        }}
        loadingLabel="Checking membership..."
        buttonConfig={{
          label: 'Request',
          icon: UserPlus,
          variant: 'default',
          onClick: vi.fn(),
        }}
        showDisabledReason={false}
        disabledAriaLabel="Request"
        onDisabledReasonOpenChange={vi.fn()}
        onDisabledPointerDown={vi.fn()}
        onDisabledPointerUp={vi.fn()}
        onDisabledPointerCancel={vi.fn()}
        onDisabledPointerLeave={vi.fn()}
        onDisabledBlur={vi.fn()}
      />
    );

    const button = screen.getByRole('button');

    expect(button.getAttribute('data-loading')).toBe('true');
    expect(screen.getByText('Checking membership...')).not.toBeNull();
  });
});
