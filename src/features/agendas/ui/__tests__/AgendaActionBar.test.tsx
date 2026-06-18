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

describe('AgendaActionBar', () => {
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
