/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(
      screen.queryByRole('button', { name: 'features.events.navigation.previous' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'features.events.navigation.complete' })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'features.events.navigation.next' })).toBeNull();

    rerender(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        currentAgendaItem={null}
        currentItemLabel={null}
      />
    );

    expect(screen.queryByRole('button', { name: 'features.events.navigation.start' })).toBeNull();
  });

  it('renders agenda lifecycle controls when agenda management rights are present', () => {
    const onOpenCurrentItem = vi.fn();
    const onPreviousItem = vi.fn();
    const onNextItem = vi.fn();
    const onCompleteItem = vi.fn();
    const onStartItem = vi.fn();
    const { rerender } = render(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        canManageAgenda
        currentItemLabel="TOP-1"
        onOpenCurrentItem={onOpenCurrentItem}
        onPreviousItem={onPreviousItem}
        onNextItem={onNextItem}
        onCompleteItem={onCompleteItem}
        onStartItem={onStartItem}
      />
    );

    expect(
      screen.getByRole('button', { name: 'features.events.navigation.previous' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'features.events.navigation.complete' })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'features.events.navigation.next' })).toBeTruthy();

    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.item.previous"]')!);
    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.item.open"]')!);
    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.item.complete"]')!);
    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.item.next"]')!);

    expect(onPreviousItem).toHaveBeenCalledTimes(1);
    expect(onOpenCurrentItem).toHaveBeenCalledTimes(1);
    expect(onCompleteItem).toHaveBeenCalledTimes(1);
    expect(onNextItem).toHaveBeenCalledTimes(1);

    rerender(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        canManageAgenda
        currentAgendaItem={null}
        currentItemLabel={null}
        onStartItem={onStartItem}
      />
    );

    const startButton = screen.getByRole('button', { name: 'features.events.navigation.start' });
    expect(startButton.getAttribute('data-action-id')).toBe('agendas.toolbar.item.start');
    fireEvent.click(startButton);
    expect(onStartItem).toHaveBeenCalledTimes(1);
  });

  it('renders the Enter Tally button when enabled by the container', () => {
    const onOfflineTallyClick = vi.fn();
    render(
      <AgendaActionBar
        {...baseProps}
        showOfflineTallyButton
        onOfflineTallyClick={onOfflineTallyClick}
      />
    );

    const tallyButton = screen.getByText('Enter Tally').closest('button')!;
    expect(tallyButton.getAttribute('data-action-id')).toBe('agendas.toolbar.offline-tally.open');
    fireEvent.click(tallyButton);
    expect(onOfflineTallyClick).toHaveBeenCalledTimes(1);
  });

  it('does not render the Enter Tally button when the container hides it', () => {
    render(<AgendaActionBar {...baseProps} />);

    expect(screen.queryByText('Enter Tally')).toBeNull();
  });

  it('renders agenda shortcuts as links for opening in a new tab', () => {
    render(<AgendaActionBar {...baseProps} canManageAgenda onBackToAgenda={() => undefined} />);

    expect(
      screen.getByRole('link', { name: 'features.events.agenda.backToAgenda' }).getAttribute('href')
    ).toBe('/event/event-1/agenda');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.backToAgenda' })
        .getAttribute('data-action-id')
    ).toBe('agendas.toolbar.navigate.back');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.quickActions.addItem' })
        .getAttribute('href')
    ).toBe('/create/agenda-item?eventId=event-1');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.quickActions.addItem' })
        .getAttribute('data-action-id')
    ).toBe('agendas.toolbar.item.create');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.quickActions.createElection' })
        .getAttribute('href')
    ).toBe('/create/agenda-item?eventId=event-1&type=election');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.quickActions.createElection' })
        .getAttribute('data-action-id')
    ).toBe('agendas.toolbar.election.create');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.quickActions.createVote' })
        .getAttribute('href')
    ).toBe('/create/agenda-item?eventId=event-1&type=vote');
    expect(
      screen
        .getByRole('link', { name: 'features.events.agenda.quickActions.createVote' })
        .getAttribute('data-action-id')
    ).toBe('agendas.toolbar.vote.create');
  });

  it('renders a back-only context group without management shortcuts', () => {
    const { container } = render(
      <AgendaActionBar {...baseProps} currentAgendaItem={null} onBackToAgenda={noop} />
    );

    expect(container.querySelector('[data-agenda-toolbar-group="context"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'features.events.agenda.backToAgenda' })).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'features.events.agenda.quickActions.addItem' })
    ).toBeNull();
  });

  it('renders the Vote button during indicative and final voting, but not while pending', () => {
    const onVoteClick = vi.fn();
    const { container, rerender } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'pending',
        }}
        canVote
        onVoteClick={onVoteClick}
      />
    );

    expect(container.querySelector('.civic-ballot-submit')).toBeNull();

    rerender(<AgendaActionBar {...baseProps} canVote onVoteClick={onVoteClick} />);

    const indicativeVoteButton = container.querySelector('.civic-ballot-submit')!;
    expect(indicativeVoteButton.getAttribute('data-action-id')).toBe('agendas.toolbar.ballot.cast');
    fireEvent.click(indicativeVoteButton);
    expect(onVoteClick).toHaveBeenCalledTimes(1);

    rerender(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'final',
        }}
        canVote
        onVoteClick={onVoteClick}
      />
    );

    const voteButton = container.querySelector('.civic-ballot-submit')!;
    expect(voteButton.getAttribute('data-action-id')).toBe('agendas.toolbar.ballot.cast');
    fireEvent.click(voteButton);
    expect(onVoteClick).toHaveBeenCalledTimes(2);
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

  it('renders the disabled Vote button with the provided info tooltip', async () => {
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
    (voteButton as HTMLElement).focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain(
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
      screen
        .getByRole('button', { name: 'features.events.agenda.actions.startFinalVote' })
        .hasAttribute('disabled')
    ).toBe(true);
  });

  it('uses custom final vote labels as tooltip and accessible name for start and close actions', () => {
    const onStartVote = vi.fn();
    const onStartFinalVote = vi.fn();
    const onCloseFinalVote = vi.fn();
    const { rerender } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'pending',
        }}
        canManageAgenda
        onStartVote={onStartVote}
        startVoteTooltip="Start final change request vote: Branch 2 CR-2"
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Start final change request vote: Branch 2 CR-2',
      })
    ).toBeTruthy();
    const startVoteButton = screen.getByRole('button', {
      name: 'Start final change request vote: Branch 2 CR-2',
    });
    expect(startVoteButton.getAttribute('data-action-id')).toBe('agendas.toolbar.vote.start');
    fireEvent.click(startVoteButton);
    expect(onStartVote).toHaveBeenCalledTimes(1);

    rerender(
      <AgendaActionBar
        {...baseProps}
        canManageAgenda
        onStartFinalVote={onStartFinalVote}
        startFinalVoteTooltip="Start final closing vote: Amendment A"
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Start final closing vote: Amendment A',
      })
    ).toBeTruthy();
    const startFinalVoteButton = screen.getByRole('button', {
      name: 'Start final closing vote: Amendment A',
    });
    expect(startFinalVoteButton.getAttribute('data-action-id')).toBe(
      'agendas.toolbar.vote.start-final'
    );
    fireEvent.click(startFinalVoteButton);
    expect(onStartFinalVote).toHaveBeenCalledTimes(1);

    rerender(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          voting_phase: 'final',
        }}
        canManageAgenda
        onCloseFinalVote={onCloseFinalVote}
        closeVoteTooltip="Close final merge vote Branch 1 VS Branch 2"
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Close final merge vote Branch 1 VS Branch 2',
      })
    ).toBeTruthy();
    const closeFinalVoteButton = screen.getByRole('button', {
      name: 'Close final merge vote Branch 1 VS Branch 2',
    });
    expect(closeFinalVoteButton.getAttribute('data-action-id')).toBe(
      'agendas.toolbar.vote.close-final'
    );
    fireEvent.click(closeFinalVoteButton);
    expect(onCloseFinalVote).toHaveBeenCalledTimes(1);
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

    const jumpButton = screen.getByRole('button', { name: 'Next voting step' });
    expect(jumpButton.getAttribute('data-action-id')).toBe('agendas.toolbar.vote-step.next');
    jumpButton.click();

    expect(handleJump).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback label for the jump action', () => {
    render(<AgendaActionBar {...baseProps} canManageAgenda onJumpToNextVoteStep={noop} />);

    expect(screen.getByRole('button', { name: 'Next voting step' })).toBeTruthy();
  });

  it('renders election voting, edit tally, and completed lifecycle variants', () => {
    const electionItem = {
      id: 'election-item',
      type: 'election',
      status: 'in-progress',
      voting_phase: 'final',
      election: { id: 'election-1' },
    };
    const { container } = render(
      <AgendaActionBar
        {...baseProps}
        {...lifecycleProps}
        currentAgendaItem={electionItem}
        canManageAgenda
        canVote
        isCurrentItemCompleted
        offlineTallyMode="edit"
        onOfflineTallyClick={noop}
        onVoteClick={noop}
      />
    );

    expect(
      container
        .querySelector('[data-action-id="agendas.toolbar.ballot.cast"]')
        ?.getAttribute('data-tutorial-anchor')
    ).toBe('agenda-election-vote');
    expect(
      container.querySelector('[data-action-id="agendas.toolbar.offline-tally.open"] svg')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-action-id="agendas.toolbar.item.complete"]')?.className
    ).toContain('bg-[var(--badge-success-bg)]');
  });

  it('renders next-item navigation without a current item', () => {
    render(
      <AgendaActionBar {...baseProps} canManageAgenda currentAgendaItem={null} onNextItem={noop} />
    );

    expect(screen.getByRole('button', { name: 'features.events.navigation.next' })).toBeTruthy();
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

  it('dispatches agenda management actions through stable identities', () => {
    const callbacks = {
      onMoveToEvent: vi.fn(),
      onEditItem: vi.fn(),
      onDeleteItem: vi.fn(),
      onPreviousChangeRequest: vi.fn(),
      onNextChangeRequest: vi.fn(),
    };

    render(
      <AgendaActionBar
        {...baseProps}
        canManageAgenda
        hasPreviousChangeRequest
        hasNextChangeRequest
        {...callbacks}
      />
    );

    for (const [actionId, callback] of [
      ['agendas.toolbar.item.move-event', callbacks.onMoveToEvent],
      ['agendas.toolbar.item.edit', callbacks.onEditItem],
      ['agendas.toolbar.item.delete', callbacks.onDeleteItem],
      ['agendas.toolbar.change-request.previous', callbacks.onPreviousChangeRequest],
      ['agendas.toolbar.change-request.next', callbacks.onNextChangeRequest],
    ] as const) {
      const action = document.querySelector(`[data-action-id="${actionId}"]`)!;
      fireEvent.click(action);
      expect(callback).toHaveBeenCalledTimes(1);
    }
  });

  it('dispatches speaker and candidacy actions across their controlled states', () => {
    const onJoinSpeakerList = vi.fn();
    const onLeaveSpeakerList = vi.fn();
    const onBecomeCandidate = vi.fn();
    const onWithdrawCandidacy = vi.fn();
    const electionItem = {
      id: 'election-item',
      type: 'election',
      status: 'in-progress',
      voting_phase: 'indication',
      election: { id: 'election-1' },
    };
    const { rerender } = render(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={electionItem}
        canBeCandidate
        onJoinSpeakerList={onJoinSpeakerList}
        onBecomeCandidate={onBecomeCandidate}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.speaker.join"]')!);
    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.candidacy.become"]')!);
    expect(onJoinSpeakerList).toHaveBeenCalledTimes(1);
    expect(onBecomeCandidate).toHaveBeenCalledTimes(1);

    rerender(
      <AgendaActionBar
        {...baseProps}
        currentAgendaItem={electionItem}
        canBeCandidate
        isUserInSpeakerList
        isUserCandidate
        onLeaveSpeakerList={onLeaveSpeakerList}
        onWithdrawCandidacy={onWithdrawCandidacy}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="agendas.toolbar.speaker.leave"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.toolbar.candidacy.withdraw"]')!
    );
    expect(onLeaveSpeakerList).toHaveBeenCalledTimes(1);
    expect(onWithdrawCandidacy).toHaveBeenCalledTimes(1);
  });
});
