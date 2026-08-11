/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationRequestNoticeView } from '../ConfirmationRequestNoticeView';

const labels = {
  title: 'Confirmations',
  description: 'Description',
  untitled: 'Untitled',
  changeRequest: 'Change request',
  viewChanges: 'View',
  confirm: 'Confirm',
  decline: 'Decline',
};

describe('ConfirmationRequestNoticeView A04 branch accountability', () => {
  afterEach(cleanup);

  it('returns null without confirmations', () => {
    const { container } = render(
      <ConfirmationRequestNoticeView
        labels={labels}
        pendingConfirmations={[]}
        processingId={null}
        onConfirmClick={vi.fn()}
        onDeclineClick={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders fallbacks and dispatches all row actions', () => {
    const view = vi.fn();
    const confirm = vi.fn();
    const decline = vi.fn();
    const { container } = render(
      <ConfirmationRequestNoticeView
        labels={labels}
        pendingConfirmations={[
          {
            id: 'one',
            amendment: { id: 'amendment', title: 'Title' },
            changeRequest: { title: 'CR' },
          } as any,
          { id: 'two', amendment: { id: null, title: null } },
        ]}
        processingId="one"
        onViewChanges={view}
        onConfirmClick={confirm}
        onDeclineClick={decline}
      />
    );
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Untitled')).toBeTruthy();
    expect(screen.getByText(/CR/)).toBeTruthy();

    const viewButtons = container.querySelectorAll(
      '[data-action-id="amendments.confirmation.navigate.changes"]'
    );
    fireEvent.click(viewButtons[0]);
    fireEvent.click(viewButtons[1]);
    expect(view).toHaveBeenNthCalledWith(1, 'one', 'amendment');
    expect(view).toHaveBeenNthCalledWith(2, 'two', '');
    fireEvent.click(
      container.querySelectorAll('[data-action-id="amendments.confirmation.accept.request"]')[1]
    );
    fireEvent.click(
      container.querySelectorAll('[data-action-id="amendments.confirmation.decline.request"]')[1]
    );
    expect(confirm).toHaveBeenCalledWith('two');
    expect(decline).toHaveBeenCalledWith('two');
  });

  it('tolerates an absent view callback', () => {
    const { container } = render(
      <ConfirmationRequestNoticeView
        labels={labels}
        pendingConfirmations={[{ id: 'one', amendment: null }]}
        processingId={null}
        onConfirmClick={vi.fn()}
        onDeclineClick={vi.fn()}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.confirmation.navigate.changes"]')!
    );
  });
});
