/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupMembershipButton } from '../ui/GroupMembershipButton';
import { PendingRequestActionCellView } from '../ui/PendingRequestActionCellView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('../ui/GroupConflictPanel', () => ({
  GroupConflictDialog: ({ triggerLabel }: { triggerLabel: string }) => (
    <button>{triggerLabel}</button>
  ),
}));

afterEach(cleanup);

function MembershipRequestFlow() {
  const [state, setState] = useState<'none' | 'requested' | 'active' | 'rejected'>('none');
  return (
    <div>
      <output aria-label="membership-state">{state}</output>
      {state === 'none' || state === 'requested' ? (
        <GroupMembershipButton
          status={state === 'requested' ? 'requested' : null}
          isMember={false}
          hasRequested={state === 'requested'}
          isInvited={false}
          isLoading={false}
          onRequestJoin={() => setState('requested')}
          onLeave={() => setState('none')}
          onAcceptInvitation={() => undefined}
        />
      ) : null}
      {state === 'requested' ? (
        <PendingRequestActionCellView
          membership={{ id: 'membership-1' }}
          userId="applicant-1"
          onApprove={() => setState('active')}
          onReject={() => setState('rejected')}
          primaryActionLabel="Approve membership"
          secondaryActionLabel="Reject membership"
          blocking={false}
          response={{ blocking: false, conflicts: [] }}
          labels={{ why: 'Why?', checking: 'Checking', blockedTitle: 'Blocked' }}
        />
      ) : null}
    </div>
  );
}

describe('membership request component flow', () => {
  it('requests membership and exposes the pending review action', () => {
    render(<MembershipRequestFlow />);
    fireEvent.click(screen.getByRole('button', { name: /requestToJoin/i }));
    expect(screen.getByLabelText('membership-state').textContent).toBe('requested');
    expect(
      (screen.getByRole('button', { name: 'Approve membership' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('approves a request and removes the pending controls', () => {
    render(<MembershipRequestFlow />);
    fireEvent.click(screen.getByRole('button', { name: /requestToJoin/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve membership' }));
    expect(screen.getByLabelText('membership-state').textContent).toBe('active');
    expect(screen.queryByRole('button', { name: 'Approve membership' })).toBeNull();
  });

  it('rejects a request and updates the rendered membership state', () => {
    render(<MembershipRequestFlow />);
    fireEvent.click(screen.getByRole('button', { name: /requestToJoin/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject membership' }));
    expect(screen.getByLabelText('membership-state').textContent).toBe('rejected');
    expect(screen.queryByRole('button', { name: 'Reject membership' })).toBeNull();
  });
});
