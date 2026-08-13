/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock('motion/react', () => {
  const Motion = ({ animate: _a, exit: _e, initial: _i, transition: _t, ...props }: any) => (
    <div {...props} />
  );
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: { div: Motion, span: Motion },
    useReducedMotion: () => mocks.reducedMotion,
  };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/errors', () => ({
  localizeAppError: (error: any) => `localized:${error?.message ?? 'error'}`,
  parseAppError: (error: any) => error ?? null,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ alt }: any) => <span>{`avatar:${alt}`}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  LoadingProgressBar: ({ steps }: any) => <div data-testid="progress">{steps.length}</div>,
}));

import { VoteSubmissionOverlay } from '../VoteSubmissionOverlay';

const progressSteps = [
  { copy: { key: 'verify' }, key: 'verify', status: 'pending' },
  { copy: { key: 'cast' }, key: 'cast', status: 'active' },
  { copy: { key: 'sync' }, key: 'sync', status: 'error' },
  { copy: { key: 'sync' }, key: 'sync', status: 'complete' },
] as any;

function props(overrides: Record<string, unknown> = {}) {
  return {
    onBack: vi.fn(),
    onRetry: vi.fn(),
    progressSteps,
    selection: { choiceLabel: 'Yes', phase: 'open', type: 'vote' },
    status: 'casting',
    ...overrides,
  } as any;
}

beforeEach(() => {
  mocks.reducedMotion = false;
});
afterEach(cleanup);

describe('VoteSubmissionOverlay', () => {
  it('covers idle, running vote, election, and success states', () => {
    const view = render(<VoteSubmissionOverlay {...props({ status: 'idle' })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<VoteSubmissionOverlay {...props()} />);
    expect(screen.getByText('common.voteSubmission.voteDescription')).toBeTruthy();
    view.rerender(
      <VoteSubmissionOverlay
        {...props({
          selection: {
            candidates: [
              { avatar: 'ada.png', id: 'ada', name: 'ada' },
              { id: 'grace', name: 'Grace' },
            ],
            maxVotes: 2,
            phase: 'open',
            title: 'Election',
            type: 'election',
          },
          status: 'verifying',
        })}
      />
    );
    expect(screen.getByText('common.voteSubmission.electionDescription')).toBeTruthy();
    expect(screen.getByText(/common.voteSubmission.selectedVotes/)).toBeTruthy();
    view.rerender(
      <VoteSubmissionOverlay
        {...props({ selection: { phase: 'open', type: 'election' }, status: 'syncing' })}
      />
    );
    expect(screen.queryByText('Election')).toBeNull();
    view.rerender(<VoteSubmissionOverlay {...props({ status: 'success' })} />);
    expect(screen.getByText('common.voteSubmission.successDescription')).toBeTruthy();
  });

  it.each([
    'vote_already_submitted',
    'already_exists',
    'permission_denied',
    'vote_not_eligible',
    'voting_password_missing',
    'voting_password_invalid',
  ])('renders non-retryable %s errors', code => {
    const onBack = vi.fn();
    render(<VoteSubmissionOverlay {...props({ error: { code }, onBack, status: 'error' })} />);
    expect(screen.queryByText('common.submissionOverlay.retry')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders retryable errors and reduced-motion paths', () => {
    mocks.reducedMotion = true;
    const onBack = vi.fn();
    const onRetry = vi.fn();
    render(
      <VoteSubmissionOverlay
        {...props({
          error: { code: 'network', message: 'Offline' },
          onBack,
          onRetry,
          status: 'error',
        })}
      />
    );
    expect(screen.getByText('localized:Offline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.submissionOverlay.retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
