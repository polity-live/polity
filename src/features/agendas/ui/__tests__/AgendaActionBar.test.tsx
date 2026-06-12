/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../FixedAgendaToolbar', () => ({
  FixedAgendaToolbar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="fixed-agenda-toolbar">{children}</div>
  ),
}));

vi.mock('@/features/shared/ui/ui/toolbar', () => ({
  ToolbarButton: ({
    children,
    onClick,
    disabled,
    className,
    title,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
  }) => (
    <button className={className} disabled={disabled} onClick={onClick} title={title} type="button">
      {children}
    </button>
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
});
