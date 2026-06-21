/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/features/shared/ui/ui/button';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) =>
    fallback ?? (key.includes('enter_tally') ? 'Enter Tally' : key),
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../FixedAgendaToolbar', () => ({
  FixedAgendaToolbar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="fixed-agenda-toolbar">{children}</div>
  ),
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({
    children,
    onClick,
    disabled,
    className,
    title,
    tooltip,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
    tooltip?: React.ReactNode;
  }) => (
    <Button
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title || (typeof tooltip === 'string' ? tooltip : undefined)}
      type="button"
      {...props}
    >
      {children}
    </Button>
  ),
}));

import { AgendaActionBar } from '../AgendaActionBar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = {
  eventId: 'event-1',
  currentAgendaItem: {
    id: 'item-1',
    type: 'vote',
    status: 'in-progress',
    voting_phase: 'indication',
    vote: { id: 'vote-1' },
  },
  canManageAgenda: false,
  canVote: false,
  canBeCandidate: false,
  isEventStarted: true,
  isUserInSpeakerList: false,
  isUserCandidate: false,
};

const noop = () => undefined;

const lifecycleProps = {
  hasPreviousItem: true,
  hasNextItem: true,
  hasStartableItem: true,
  canMoveToNextItem: true,
  onStartItem: noop,
  onPreviousItem: noop,
  onNextItem: noop,
  onCompleteItem: noop,
};

describe('AgendaActionBar', () => {
  it('hides agenda lifecycle controls when agenda management rights are missing', () => {
    const { rerender } = render(
      <AgendaActionBar {...baseProps} {...lifecycleProps} currentItemLabel="TOP-1" />
    );

    expect(screen.getByText('TOP-1')).toBeTruthy();
    expect(screen.queryByTitle('features.events.navigation.previous')).toBeNull();
    expect(screen.queryByTitle('features.events.navigation.complete')).toBeNull();
    expect(screen.queryByTitle('features.events.navigation.next')).toBeNull();

    rerender(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        currentAgendaItem={null}
        currentItemLabel={null}
      />
    );

    expect(screen.queryByTitle('features.events.navigation.start')).toBeNull();
  });

  it('renders agenda lifecycle controls when agenda management rights are present', () => {
    const { rerender } = render(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        canManageAgenda
        currentItemLabel="TOP-1"
      />
    );

    expect(screen.getByTitle('features.events.navigation.previous')).toBeTruthy();
    expect(screen.getByTitle('features.events.navigation.complete')).toBeTruthy();
    expect(screen.getByTitle('features.events.navigation.next')).toBeTruthy();

    rerender(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        canManageAgenda
        currentAgendaItem={null}
        currentItemLabel={null}
      />
    );

    expect(screen.getByTitle('features.events.navigation.start')).toBeTruthy();
  });

  it('renders the Enter Tally button when enabled by the container', () => {
    render(
      <AgendaActionBar
        {...baseProps}
        showOfflineTallyButton
        onOfflineTallyClick={() => undefined}
      />
    );

    expect(screen.getByText('Enter Tally')).toBeTruthy();
  });

  it('does not render the Enter Tally button when the container hides it', () => {
    render(<AgendaActionBar {...baseProps} />);

    expect(screen.queryByText('Enter Tally')).toBeNull();
  });

  it('renders the Vote button for pending votable items when voting is available', () => {
    const { container } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'pending',
        }}
        canVote
        onVoteClick={() => undefined}
      />
    );

    expect(container.querySelector('.civic-ballot-submit')).toBeTruthy();
  });

  it('renders the Vote button as blocked with help when active voting rights are missing', () => {
    const { container } = render(<AgendaActionBar {...baseProps} onVoteClick={() => undefined} />);

    const voteButton = container.querySelector('.civic-ballot-submit');

    expect(voteButton).toBeTruthy();
    expect(voteButton?.getAttribute('aria-disabled')).toBe('true');
    expect(voteButton?.className).toContain('text-muted-foreground');
  });

  it('renders the disabled Vote button with the provided info tooltip', () => {
    const { container } = render(
      <AgendaActionBar
        {...baseProps}
        canVote
        disableVoteButton
        disabledVoteTooltip="Geheime indikative Stimmen können nicht geändert werden."
        onVoteClick={() => undefined}
      />
    );

    const voteButton = container.querySelector('.civic-ballot-submit');

    expect(voteButton?.getAttribute('aria-disabled')).toBe('true');
    expect(voteButton?.getAttribute('title')).toBe(
      'Geheime indikative Stimmen können nicht geändert werden.'
    );
    expect(voteButton?.className).toContain('text-muted-foreground');
  });

  it('disables the start final vote action while a vote action is loading', () => {
    render(
      <AgendaActionBar
        {...baseProps}
        canManageAgenda
        voteLoading
        onStartFinalVote={() => undefined}
      />
    );

    expect(
      screen.getByTitle('features.events.agenda.actions.startFinalVote').hasAttribute('disabled')
    ).toBe(true);
  });

  it('renders the candidate button as blocked with help when passive voting rights are missing', () => {
    render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          id: 'item-1',
          type: 'election',
          status: 'in-progress',
          voting_phase: 'indication',
          election: { id: 'election-1' },
        }}
        onBecomeCandidate={() => undefined}
      />
    );

    const candidateButton = screen.getByRole('button', {
      name: 'Passive Voting Rights are required to become a candidate in this event.',
    });

    expect(candidateButton.getAttribute('aria-disabled')).toBe('true');
    expect(candidateButton.className).toContain('text-muted-foreground');
  });
});
