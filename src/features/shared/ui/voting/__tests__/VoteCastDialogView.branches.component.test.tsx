// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dialogProps: undefined as any,
  passwordProps: undefined as any,
  reducedMotion: true,
  scrollableProps: undefined as any,
}));

vi.mock('motion/react', () => {
  const MotionElement = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    layout: _layout,
    transition: _transition,
    variants: _variants,
    whileTap: _whileTap,
    ...props
  }: any) => <div {...props} />;
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: { div: MotionElement, span: MotionElement },
    useReducedMotion: () => mocks.reducedMotion,
  };
});

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: (props: any) => {
    mocks.scrollableProps = props;
    return <div data-testid="dialog-content">{props.children}</div>;
  },
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: (props: any) => {
    mocks.dialogProps = props;
    return <div>{props.children}</div>;
  },
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ alt }: any) => (alt ? <span>{`avatar:${alt}`}</span> : null),
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('../VotePasswordInput', () => ({
  VotePasswordInput: (props: any) => {
    mocks.passwordProps = props;
    return <div data-testid="password-input" />;
  },
}));

vi.mock('../VotingControls', () => ({
  VotingPhaseBadge: ({ phase }: any) => <span>{phase}</span>,
}));

import { VoteCastDialogView, type VoteCastDialogViewProps } from '../VoteCastDialogView';

function props(overrides: Partial<VoteCastDialogViewProps> = {}): VoteCastDialogViewProps {
  return {
    choices: undefined,
    labels: {
      cancel: 'Cancel',
      castVote: 'Cast vote',
      confirm: 'Confirm',
      confirmWithPassword: 'Confirm with password',
      yourChoice: 'Your choice',
    },
    maxVotes: 1,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
    onPasswordSubmit: vi.fn(),
    onSelectChoice: vi.fn(),
    onToggleCandidate: vi.fn(),
    open: true,
    phase: 'open' as never,
    selectedCandidateIds: [],
    selectedChoiceId: null,
    step: 'choice',
    ...overrides,
  };
}

describe('VoteCastDialogView branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reducedMotion = true;
  });

  afterEach(cleanup);

  it('renders the complete reduced-motion list-election choice state', () => {
    const viewProps = props({
      candidates: [
        { avatar: 'ada.png', id: 'ada', name: 'ada' },
        { id: 'grace', name: 'Grace' },
      ],
      documentPreviewContent: <div>Document preview</div>,
      forwardingPreviewContent: <div>Forwarding preview</div>,
      isListElection: true,
      isMultiSelect: true,
      labels: {
        assignedVotes: 'Assigned votes',
        cancel: 'Cancel',
        castVote: 'Cast vote',
        confirm: 'Confirm',
        confirmWithPassword: 'Confirm with password',
        electionModeSummary: 'List election',
        remainingVotes: 'Remaining votes',
        selectUpTo: 'Select up to two',
        yourChoice: 'Your choice',
      },
      maxVotes: 2,
      selectedCandidateIds: ['ada'],
      title: 'Board election',
      tutorialAnchor: 'agenda-election-vote',
    });
    render(<VoteCastDialogView {...viewProps} />);

    expect(screen.getByText('Assigned votes')).toBeTruthy();
    expect(screen.getByText('Remaining votes')).toBeTruthy();
    expect(screen.getByText('Document preview')).toBeTruthy();
    expect(screen.getByText('Forwarding preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Grace/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(viewProps.onToggleCandidate).toHaveBeenCalledWith('grace');
    expect(viewProps.onConfirm).toHaveBeenCalled();
    expect(viewProps.onCancel).toHaveBeenCalled();

    const outside = { preventDefault: vi.fn() };
    mocks.scrollableProps.onInteractOutside(outside);
    mocks.scrollableProps.onEscapeKeyDown(outside);
    expect(outside.preventDefault).toHaveBeenCalledTimes(2);
    expect(mocks.dialogProps.modal).toBe(false);
  });

  it('covers amendment anchors, plain counters, regex acceptance, and optional labels', () => {
    const viewProps = props({
      choices: [
        { id: 'accept', label: 'Accept', semanticKey: 'accept' },
        { id: 'yes', label: ' YES ', semanticKey: null },
        { id: 'no', label: 'No', semanticKey: null },
      ],
      isMultiSelect: true,
      maxVotes: 0,
      selectedChoiceId: 'accept',
      tutorialAnchor: 'agenda-amendment-vote',
    });
    const view = render(<VoteCastDialogView {...viewProps} />);

    expect(screen.getByText('0/0')).toBeTruthy();
    expect(screen.getByText('0 offen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /YES/ }));
    expect(viewProps.onSelectChoice).toHaveBeenCalledWith('yes');
    expect(document.querySelectorAll('[data-tutorial-anchor="agenda-amendment-yes"]')).toHaveLength(
      2
    );

    view.rerender(
      <VoteCastDialogView
        {...props({ choices: viewProps.choices, selectedChoiceId: 'stale-choice' })}
      />
    );
    expect(screen.getByText('Your choice')).toBeTruthy();
  });

  it('renders both password tutorial targets and forwards password state', () => {
    const election = props({
      documentPreviewContent: <div>Password document</div>,
      isPasswordVerifying: true,
      noVotingPasswordSettingsHref: '/settings',
      passwordError: 'Wrong password',
      step: 'password',
      tutorialAnchor: 'agenda-election-vote',
    });
    const view = render(<VoteCastDialogView {...election} />);
    expect(screen.getByTestId('password-input')).toBeTruthy();
    expect(mocks.passwordProps).toMatchObject({
      error: 'Wrong password',
      isLoading: true,
      noVotingPasswordSettingsHref: '/settings',
      onSubmit: election.onPasswordSubmit,
    });
    expect(
      document.querySelector('[data-tutorial-anchor="agenda-election-password"]')
    ).toBeTruthy();

    view.rerender(
      <VoteCastDialogView
        {...props({ step: 'password', tutorialAnchor: 'agenda-amendment-vote' })}
      />
    );
    expect(
      document.querySelector('[data-tutorial-anchor="agenda-amendment-password"]')
    ).toBeTruthy();

    view.rerender(<VoteCastDialogView {...props({ step: 'password' })} />);
    expect(document.querySelector('[data-tutorial-anchor]')).toBeNull();
  });

  it('shows only the submission overlay while submission is active', () => {
    render(
      <VoteCastDialogView
        {...props({
          submissionActive: true,
          submissionOverlay: <div>Submitting vote</div>,
        })}
      />
    );
    expect(screen.getByText('Submitting vote')).toBeTruthy();
    expect(screen.queryByText('Cast vote')).toBeNull();

    const outside = { preventDefault: vi.fn() };
    mocks.scrollableProps.onInteractOutside(outside);
    mocks.scrollableProps.onEscapeKeyDown(outside);
    expect(outside.preventDefault).not.toHaveBeenCalled();
    expect(mocks.dialogProps.modal).toBe(true);
  });
});
