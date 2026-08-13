/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PendingRequestActionCellView } from '../PendingRequestActionCellView';

afterEach(cleanup);

describe('PendingRequestActionCellView loading state', () => {
  it('shows approval preflight progress on the approve action', () => {
    render(
      <PendingRequestActionCellView
        membership={{ id: 'membership-1' }}
        userId="user-1"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        primaryActionLabel="Approve"
        secondaryActionLabel="Reject"
        blocking={false}
        checking
        response={{ blocking: false, conflicts: [] }}
        labels={{
          why: 'Why?',
          checking: 'Checking approval...',
          blockedTitle: 'Blocked',
        }}
      />
    );

    const approveButton = screen.getByRole('button', { name: 'Checking approval...' });

    expect(approveButton.getAttribute('data-loading')).toBe('true');
    expect(approveButton.getAttribute('aria-busy')).toBe('true');
  });

  it('dispatches approval and rejection through stable actions', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const { container } = render(
      <PendingRequestActionCellView
        membership={{ id: 'membership-1' }}
        userId="user-1"
        onApprove={onApprove}
        onReject={onReject}
        primaryActionLabel="Approve"
        secondaryActionLabel="Reject"
        blocking={false}
        response={{ blocking: false, conflicts: [] }}
        labels={{ why: 'Why?', checking: 'Checking approval...', blockedTitle: 'Blocked' }}
      />
    );

    fireEvent.click(
      container.querySelector('[data-action-id="groups.requests.approve.membership"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="groups.requests.reject.membership"]')!
    );
    expect(onApprove).toHaveBeenCalledWith('membership-1', 'user-1');
    expect(onReject).toHaveBeenCalledWith('membership-1', 'user-1');
  });
});
