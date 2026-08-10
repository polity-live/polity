/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blocking: false,
  isLoading: false,
  response: null as unknown,
  preflight: vi.fn(),
  reset: vi.fn(),
  retry: vi.fn(),
  rejectAction: false,
  previews: [] as Record<string, unknown>[],
  runActionWithSubmission: vi.fn(),
}));

vi.mock('@/features/groups/hooks/useGroupConflictPreflight', () => ({
  useGroupConflictPreflight: (input: unknown, options: unknown) => {
    mocks.preflight(input, options);
    return {
      response: mocks.response,
      blocking: mocks.blocking,
      isLoading: mocks.isLoading,
    };
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    status: 'idle',
    progressSteps: [],
    error: null,
    isActive: false,
    reset: mocks.reset,
    retry: mocks.retry,
    runActionWithSubmission: mocks.runActionWithSubmission,
  }),
  ActionSubmissionOverlay: ({
    preview,
    target,
    onBack,
    onRetry,
  }: {
    preview: Record<string, unknown>;
    target: { onClick: () => void };
    onBack: () => void;
    onRetry: () => void;
  }) => {
    mocks.previews.push(preview);
    return (
      <div>
        <button type="button" onClick={target.onClick}>
          Done
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  },
}));

vi.mock('../InvitationActionsView', () => ({
  InvitationActionsView: ({
    onAccept,
    onDecline,
  }: {
    onAccept: () => void;
    onDecline?: (id: string) => void;
    children?: ReactNode;
  }) => (
    <div>
      <button type="button" onClick={onAccept}>
        Accept
      </button>
      <button type="button" onClick={() => onDecline?.('declined-id')}>
        Decline
      </button>
    </div>
  ),
}));

import { InvitationActions } from '../InvitationActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blocking = false;
  mocks.isLoading = false;
  mocks.response = null;
  mocks.rejectAction = false;
  mocks.previews = [];
  mocks.runActionWithSubmission.mockImplementation(
    async (action: () => Promise<unknown>, options: { onSuccess: () => void }) => {
      if (mocks.rejectAction) throw new Error('submission failed');
      await action();
      options.onSuccess();
    }
  );
});

afterEach(cleanup);

describe('InvitationActions branch campaign A07', () => {
  it.each([
    ['group', { group: { name: 'Group title' } }, 'Group title'],
    ['group fallback', { group: { name: '' } }, 'fallbackTitles.group'],
    ['event', { event: { title: 'Event title' } }, 'Event title'],
    ['event fallback', { event: { title: '' } }, 'fallbackTitles.event'],
    ['amendment', { amendment: { title: 'Amendment title' } }, 'Amendment title'],
    ['amendment fallback', { amendment: { title: '' } }, 'fallbackTitles.amendment'],
    ['blog', { blog: { title: 'Blog title' } }, 'Blog title'],
    ['blog fallback', { blog: { title: '' } }, 'fallbackTitles.blog'],
    ['generic', {}, 'invitationTitle'],
  ])('builds the %s preview', (_label, relation, expectedTitle) => {
    render(<InvitationActions item={{ id: 'invite-1', ...relation } as never} />);
    expect(String(mocks.previews.at(-1)?.title)).toContain(expectedTitle);
  });

  it('passes optional preflight state and completes all overlay actions', async () => {
    const onAccept = vi.fn(async () => undefined);
    const onDecline = vi.fn();
    const input = { membershipId: 'invite-1' } as never;
    render(
      <InvitationActions
        item={{ id: 'invite-1' } as never}
        onAccept={onAccept}
        onDecline={onDecline}
        getAcceptPreflightInput={() => input}
      />
    );

    expect(mocks.preflight).toHaveBeenCalledWith(input, { enabled: true });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(onAccept).toHaveBeenCalledWith('invite-1'));
    expect(mocks.reset).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onDecline).toHaveBeenCalledWith('declined-id');
    expect(mocks.reset).toHaveBeenCalledTimes(3);
    expect(mocks.retry).toHaveBeenCalledOnce();
  });

  it('guards absent, blocking, and loading accept handlers and swallows submission rejection', async () => {
    const onAccept = vi.fn();
    const view = render(<InvitationActions item={{ id: 'invite-1' } as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(mocks.runActionWithSubmission).not.toHaveBeenCalled();
    expect(mocks.preflight).toHaveBeenCalledWith(null, { enabled: false });

    mocks.blocking = true;
    view.rerender(<InvitationActions item={{ id: 'invite-1' } as never} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(mocks.runActionWithSubmission).not.toHaveBeenCalled();

    mocks.blocking = false;
    mocks.isLoading = true;
    view.rerender(<InvitationActions item={{ id: 'invite-1' } as never} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(mocks.runActionWithSubmission).not.toHaveBeenCalled();

    mocks.isLoading = false;
    mocks.rejectAction = true;
    view.rerender(<InvitationActions item={{ id: 'invite-1' } as never} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(mocks.runActionWithSubmission).toHaveBeenCalledOnce());
    expect(onAccept).not.toHaveBeenCalled();
  });
});
