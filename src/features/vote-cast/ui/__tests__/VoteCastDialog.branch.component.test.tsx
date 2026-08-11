/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_TUTORIAL_RECOVER_TARGET_EVENT } from '@/features/app-tutorial/events';
import { VoteCastDialog } from '../VoteCastDialog';

const mocks = vi.hoisted(() => ({
  latestView: null as any,
  latestOverlay: null as any,
  serverConfirmed: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/features/shared/ui/voting', () => ({
  VoteCastDialogView: (props: any) => {
    mocks.latestView = props;
    return (
      <div data-testid="vote-cast-dialog-view">
        {props.forwardingPreviewContent}
        {props.submissionOverlay}
      </div>
    );
  },
  VoteSubmissionOverlay: (props: any) => {
    mocks.latestOverlay = props;
    return <div data-testid="vote-submission-overlay">{props.status}</div>;
  },
}));

vi.mock('@/features/amendments/ui/AmendmentForwardingPreview', () => ({
  AmendmentForwardingPreview: () => <div data-testid="forwarding-preview" />,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: mocks.serverConfirmed,
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  phase: 'indication' as const,
};

function recover(anchor: string) {
  window.dispatchEvent(new CustomEvent(APP_TUTORIAL_RECOVER_TARGET_EVENT, { detail: { anchor } }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.latestView = null;
  mocks.latestOverlay = null;
  mocks.serverConfirmed.mockResolvedValue(undefined);
});

describe('VoteCastDialog branch behavior', () => {
  it('supports multi-select limits, deselection, and election submission without a seat count', async () => {
    const onCastElectionVote = vi.fn().mockResolvedValue(undefined);
    render(
      <VoteCastDialog
        {...baseProps}
        title="Election"
        candidates={[
          { id: 'alice', name: 'Alice' },
          { id: 'bob', name: 'Bob' },
          { id: 'carla', name: 'Carla' },
        ]}
        maxVotes={2}
        electionMode="list"
        onCastElectionVote={onCastElectionVote}
      />
    );

    expect(mocks.latestView.labels.electionModeSummary).not.toContain('·');
    await act(async () => mocks.latestView.onConfirm());
    expect(onCastElectionVote).not.toHaveBeenCalled();
    act(() => mocks.latestOverlay.onBack());

    act(() => mocks.latestView.onToggleCandidate('alice'));
    act(() => mocks.latestView.onToggleCandidate('bob'));
    act(() => mocks.latestView.onToggleCandidate('carla'));
    expect(mocks.latestView.selectedCandidateIds).toEqual(['alice', 'bob']);
    act(() => mocks.latestView.onToggleCandidate('alice'));
    expect(mocks.latestView.selectedCandidateIds).toEqual(['bob']);

    await act(async () => mocks.latestView.onConfirm());
    expect(onCastElectionVote).toHaveBeenCalledWith(['bob'], expect.any(Object));
  });

  it('recovers matching election tutorials and ignores unrelated targets', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <VoteCastDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        candidates={[]}
        tutorialAnchor="agenda-election-vote"
      />
    );

    act(() => recover('another-feature-choice'));
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => recover('agenda-election-password'));
    expect(mocks.latestView.step).toBe('password');
    expect(mocks.latestView.selectedCandidateIds).toEqual([]);

    rerender(
      <VoteCastDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        candidates={[{ id: 'alice', name: 'Alice' }]}
        tutorialAnchor="agenda-election-vote"
      />
    );
    act(() => recover('agenda-election-choice'));
    expect(mocks.latestView.selectedCandidateIds).toEqual(['alice']);

    const callCount = onOpenChange.mock.calls.length;
    rerender(
      <VoteCastDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        tutorialAnchor="custom-vote-dialog"
      />
    );
    act(() => recover('custom-vote-dialog-choice'));
    expect(onOpenChange).toHaveBeenCalledTimes(callCount);
  });

  it('falls back through amendment tutorial choices and renders forwarding context', () => {
    const { rerender } = render(
      <VoteCastDialog
        {...baseProps}
        tutorialAnchor="agenda-amendment-vote"
        choices={[{ id: 'custom', label: 'Custom' }]}
        forwardingPreview={{ status: 'scheduled' } as any}
      />
    );

    expect(document.querySelector('[data-testid="forwarding-preview"]')).toBeTruthy();
    act(() => recover('agenda-amendment-password'));
    expect(mocks.latestView.selectedChoiceId).toBe('custom');

    rerender(<VoteCastDialog {...baseProps} tutorialAnchor="agenda-amendment-vote" choices={[]} />);
    act(() => recover('agenda-amendment-choice'));
    expect(mocks.latestView.selectedChoiceId).toBeNull();
  });

  it('normalizes a non-Error server rejection, opens selection, and retries without a PIN', async () => {
    mocks.serverConfirmed.mockRejectedValueOnce('offline');
    const onCastVote = vi.fn(async (_choiceId: string, context: any) => {
      await context.trackServerResult({ client: 'result' });
    });
    render(
      <VoteCastDialog
        {...baseProps}
        choices={[{ id: 'accept', label: 'Accept' }]}
        onCastVote={onCastVote}
      />
    );

    act(() => mocks.latestView.onSelectChoice('accept'));
    await act(async () => mocks.latestView.onConfirm());
    expect(mocks.latestOverlay.status).toBe('error');
    expect(mocks.toastError).toHaveBeenCalled();

    act(() => mocks.toastError.mock.calls[0][1].action.onClick());
    expect(mocks.latestView.step).toBe('choice');

    mocks.serverConfirmed.mockResolvedValueOnce(undefined);
    act(() => mocks.latestOverlay.onRetry());
    await act(async () => undefined);
    expect(onCastVote).toHaveBeenCalledTimes(2);
    expect(mocks.latestOverlay.status).toBe('success');
  });

  it('returns a password-protected server rejection to PIN entry', async () => {
    mocks.serverConfirmed.mockRejectedValueOnce(new Error('server rejected'));
    const onCastVote = vi.fn(async (_choiceId: string, context: any) => {
      await context.trackServerResult({ client: 'result' });
    });
    render(
      <VoteCastDialog
        {...baseProps}
        choices={[{ id: 'accept', label: 'Accept' }]}
        requirePassword
        onPasswordSubmit={vi.fn().mockResolvedValue(undefined)}
        onCastVote={onCastVote}
      />
    );

    act(() => mocks.latestView.onSelectChoice('accept'));
    await act(async () => mocks.latestView.onConfirm());
    expect(mocks.latestView.step).toBe('password');
    await act(async () => mocks.latestView.onPasswordSubmit('1234'));
    expect(mocks.latestOverlay.status).toBe('error');

    act(() => mocks.toastError.mock.calls[0][1].action.onClick());
    expect(mocks.latestView.step).toBe('password');
    act(() => mocks.latestOverlay.onRetry());
    expect(mocks.latestView.step).toBe('password');
  });

  it('marks explicit progress errors and ignores duplicate in-flight PIN submissions', async () => {
    let releasePassword!: () => void;
    const pendingPassword = new Promise<void>(resolve => {
      releasePassword = resolve;
    });
    const onPasswordSubmit = vi.fn(() => pendingPassword);
    const onCastVote = vi.fn(async (_choiceId: string, context: any) => {
      context.reportProgress('cast', 'error');
      throw new Error('cast failed');
    });
    render(
      <VoteCastDialog
        {...baseProps}
        choices={[{ id: 'accept', label: 'Accept' }]}
        requirePassword
        onPasswordSubmit={onPasswordSubmit}
        onCastVote={onCastVote}
      />
    );

    act(() => mocks.latestView.onSelectChoice('accept'));
    let firstSubmission!: Promise<void>;
    act(() => {
      firstSubmission = mocks.latestView.onPasswordSubmit('1234');
      void mocks.latestView.onPasswordSubmit('1234');
    });
    expect(onPasswordSubmit).toHaveBeenCalledTimes(1);

    releasePassword();
    await act(async () => firstSubmission);
    expect(mocks.latestOverlay.status).toBe('error');
    expect(mocks.latestOverlay.progressSteps.some((step: any) => step.status === 'error')).toBe(
      true
    );
  });

  it('completes a selected choice even when no cast callback is supplied', async () => {
    render(<VoteCastDialog {...baseProps} choices={[{ id: 'accept', label: 'Accept' }]} />);

    act(() => mocks.latestView.onSelectChoice('accept'));
    await act(async () => mocks.latestView.onConfirm());
    expect(mocks.latestOverlay.status).toBe('success');
  });
});
