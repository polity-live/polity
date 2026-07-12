/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/features/shared/ui/ui/button';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    let href = to;

    for (const [key, value] of Object.entries(params ?? {})) {
      href = href.replace(`$${key}`, value);
    }

    const query = new URLSearchParams(search ?? {}).toString();

    return (
      <a href={query ? `${href}?${query}` : href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) =>
    fallback ?? (key.includes('enter_tally') ? 'Enter Tally' : key),
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../FixedAgendaToolbar', () => ({
  FixedAgendaToolbar: ({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="fixed-agenda-toolbar" className={className} {...props}>
      {children}
    </div>
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
  ToolbarSeparator: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="separator" className={className} {...props} />
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
  it('renders one borderless toolbar instead of card-like action groups', () => {
    const { container } = render(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        canManageAgenda
        currentItemLabel="TOP-1"
        onBackToAgenda={noop}
        onVoteClick={noop}
        currentAgendaItem={{ ...baseProps.currentAgendaItem, voting_phase: 'final' }}
      />
    );

    const toolbar = screen.getByTestId('fixed-agenda-toolbar');
    const groups = container.querySelectorAll('[data-agenda-toolbar-group]');

    expect(toolbar.className).toContain('overflow-x-auto');
    expect(toolbar.className).toContain('gap-0');
    expect(groups.length).toBe(3);
    groups.forEach(group => {
      expect(group.className).not.toMatch(/\bborder(?:-|\b)/);
      expect(group.className).not.toMatch(/\brounded(?:-|\b)/);
      expect(group.className).not.toMatch(/\bbg-(?!transparent)/);
    });
    expect(container.querySelectorAll('[data-agenda-toolbar-separator]').length).toBe(2);
  });

  it('does not render orphan separators when only navigation is visible', () => {
    const { container } = render(<AgendaActionBar {...baseProps} currentItemLabel="TOP-1" />);

    expect(container.querySelector('[data-agenda-toolbar-group="context"]')).toBeNull();
    expect(container.querySelector('[data-agenda-toolbar-group="voting"]')).toBeNull();
    expect(container.querySelector('[data-agenda-toolbar-group="navigation"]')).toBeTruthy();
    expect(container.querySelector('[data-agenda-toolbar-separator]')).toBeNull();
  });

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

  it('renders agenda shortcuts as links for opening in a new tab', () => {
    render(<AgendaActionBar {...baseProps} canManageAgenda onBackToAgenda={() => undefined} />);

    expect(
      screen.getByTitle('features.events.agenda.backToAgenda').closest('a')?.getAttribute('href')
    ).toBe('/event/event-1/agenda');
    expect(
      screen
        .getByTitle('features.events.agenda.quickActions.addItem')
        .closest('a')
        ?.getAttribute('href')
    ).toBe('/create/agenda-item?eventId=event-1');
    expect(
      screen
        .getByTitle('features.events.agenda.quickActions.createElection')
        .closest('a')
        ?.getAttribute('href')
    ).toBe('/create/agenda-item?eventId=event-1&type=election');
    expect(
      screen
        .getByTitle('features.events.agenda.quickActions.createVote')
        .closest('a')
        ?.getAttribute('href')
    ).toBe('/create/agenda-item?eventId=event-1&type=vote');
  });

  it('only renders the Vote button during the final vote phase', () => {
    const { container, rerender } = render(
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

    expect(container.querySelector('.civic-ballot-submit')).toBeNull();

    rerender(<AgendaActionBar {...baseProps} canVote onVoteClick={() => undefined} />);

    expect(container.querySelector('.civic-ballot-submit')).toBeNull();

    rerender(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'final',
        }}
        canVote
        onVoteClick={() => undefined}
      />
    );

    expect(container.querySelector('.civic-ballot-submit')).toBeTruthy();
  });

  it('renders the Vote button as blocked with help when active voting rights are missing', () => {
    const { container } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'final',
        }}
        onVoteClick={() => undefined}
      />
    );

    const voteButton = container.querySelector('.civic-ballot-submit');

    expect(voteButton).toBeTruthy();
    expect(voteButton?.getAttribute('aria-disabled')).toBe('true');
    expect(voteButton?.className).toContain('text-muted-foreground');
  });

  it('renders the disabled Vote button with the provided info tooltip', () => {
    const { container } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'final',
        }}
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

  it('uses custom final vote labels as tooltip and accessible name for start and close actions', () => {
    const { rerender } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'pending',
        }}
        canManageAgenda
        onStartVote={() => undefined}
        startVoteTooltip="Start final change request vote: Branch 2 CR-2"
      />
    );

    expect(
      screen
        .getByRole('button', {
          name: 'Start final change request vote: Branch 2 CR-2',
        })
        .getAttribute('title')
    ).toBe('Start final change request vote: Branch 2 CR-2');

    rerender(
      <AgendaActionBar
        {...baseProps}
        canManageAgenda
        onStartFinalVote={() => undefined}
        startFinalVoteTooltip="Start final closing vote: Amendment A"
      />
    );

    expect(
      screen
        .getByRole('button', {
          name: 'Start final closing vote: Amendment A',
        })
        .getAttribute('title')
    ).toBe('Start final closing vote: Amendment A');

    rerender(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'final',
        }}
        canManageAgenda
        onCloseFinalVote={() => undefined}
        closeVoteTooltip="Close final merge vote Branch 1 VS Branch 2"
      />
    );

    expect(
      screen
        .getByRole('button', {
          name: 'Close final merge vote Branch 1 VS Branch 2',
        })
        .getAttribute('title')
    ).toBe('Close final merge vote Branch 1 VS Branch 2');
  });

  it('renders the jump to next voting step action when provided', () => {
    const handleJump = vi.fn();

    render(
      <AgendaActionBar
        {...baseProps}
        canManageAgenda
        onJumpToNextVoteStep={handleJump}
        jumpToNextVoteStepTooltip="Next voting step"
      />
    );

    screen.getByTitle('Next voting step').click();

    expect(handleJump).toHaveBeenCalledTimes(1);
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
