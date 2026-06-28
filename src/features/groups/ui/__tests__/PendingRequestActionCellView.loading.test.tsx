/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
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
});
