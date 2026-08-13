/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  timelineCard: vi.fn((_props: unknown) => <div data-testid="timeline-card" />),
  passwordInput: vi.fn((_props: unknown) => <div data-testid="password-input" />),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/decision-terminal/ui/CountdownTimer', () => ({
  CountdownTimer: ({ compactLabel }: { compactLabel: string }) => <span>{compactLabel}</span>,
  EndedAgo: () => <span>ended</span>,
}));
vi.mock('@/features/agendas/ui/ChangeRequestTimelineCard', () => ({
  ChangeRequestTimelineCard: (props: unknown) => mocks.timelineCard(props),
}));
vi.mock('@/features/vote-cast/ui/VotePasswordInput', () => ({
  VotePasswordInput: (props: unknown) => mocks.passwordInput(props),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

import { AgendaCountdownPillView, AgendaEndedPillView } from '../AgendaBadgesView';
import { AccreditationSectionView } from '../AccreditationSectionView';
import { AgendaCRVoteTimelineView } from '../AgendaCRVoteTimelineView';
import { AgendaNavigationControlsView } from '../AgendaNavigationControlsView';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const accreditationController = (overrides: Record<string, unknown> = {}) =>
  ({
    accreditationsByAgendaItem: [] as any[],
    isAccredited: false,
    accreditationStatus: null,
    accreditedCount: 0,
    isLoading: false,
    canManageAccreditations: false,
    showPasswordInput: false,
    isConfirming: false,
    passwordError: null,
    noVotingPasswordSettingsHref: null,
    handleConfirmClick: vi.fn(),
    handlePasswordSubmit: vi.fn(),
    approveAccreditation: vi.fn(),
    rejectAccreditation: vi.fn(),
    revokeAccreditation: vi.fn(),
    ...overrides,
  }) as any;

describe('small agenda views', () => {
  it('hides expired countdowns and renders active countdowns', () => {
    const { container, rerender } = render(
      <AgendaCountdownPillView label="Ends" endsAt="2026-08-09" tone="end" isExpired />
    );
    expect(container.innerHTML).toBe('');

    rerender(
      <AgendaCountdownPillView label="Ends" endsAt="2026-08-09" tone="end" isExpired={false} />
    );
    expect(screen.getByText('Ends')).toBeTruthy();
  });

  it('renders ended pills only when requested', () => {
    const { container, rerender } = render(
      <AgendaEndedPillView endedAt="2026-08-09" shouldRender={false} />
    );
    expect(container.innerHTML).toBe('');
    rerender(<AgendaEndedPillView endedAt="2026-08-09" shouldRender />);
    expect(screen.getByText('ended')).toBeTruthy();
  });

  it.each([
    ['in progress', { title: 'Budget', status: 'in-progress' }],
    ['completed', { title: 'Budget', status: 'completed' }],
    ['pending', { title: 'Budget', status: 'pending' }],
    ['not selected', null],
  ])('renders the %s navigation state', (_label, currentAgendaItem) => {
    const { container } = render(
      <AgendaNavigationControlsView
        canNavigate
        completeCurrentItem={vi.fn()}
        currentAgendaItem={currentAgendaItem}
        currentIndex={0}
        eventId="event-1"
        hasNextItem
        hasPreviousItem
        isLoading={false}
        moveToNextItem={vi.fn()}
        moveToPreviousItem={vi.fn()}
        progressPercentage={50}
        t={(key: string) => key}
        totalItems={2}
      />
    );
    expect(container.textContent).toContain(
      currentAgendaItem ? currentAgendaItem.status : 'features.events.navigation.notActivated'
    );
  });

  it('shows loading icons and disables every navigation action', () => {
    const { container } = render(
      <AgendaNavigationControlsView
        canNavigate
        completeCurrentItem={vi.fn()}
        currentAgendaItem={{ title: 'Budget', status: 'active' }}
        currentIndex={0}
        eventId="event-1"
        hasNextItem={false}
        hasPreviousItem={false}
        isLoading
        moveToNextItem={vi.fn()}
        moveToPreviousItem={vi.fn()}
        progressPercentage={50}
        t={(key: string) => key}
        totalItems={2}
      />
    );
    expect(container.querySelectorAll('button:disabled')).toHaveLength(3);
    expect(container.querySelectorAll('.animate-spin')).toHaveLength(3);
  });

  it.each([
    ['loading', accreditationController({ isLoading: true }), 'skeleton'],
    ['accredited', accreditationController({ isAccredited: true }), 'confirmed'],
    [
      'pending',
      accreditationController({ accreditationStatus: 'pending' }),
      'Awaiting organizer confirmation',
    ],
  ])('renders the %s accreditation state', (_label, controller, expected) => {
    const { container } = render(<AccreditationSectionView controller={controller} />);
    expect(container.textContent?.toLowerCase()).toContain(expected.toLowerCase());
  });

  it('starts attendance confirmation before the password prompt', () => {
    const controller = accreditationController();
    render(<AccreditationSectionView controller={controller} />);
    fireEvent.click(screen.getByRole('button'));
    expect(controller.handleConfirmClick).toHaveBeenCalled();
  });

  it('forwards password state to the password input', () => {
    const controller = accreditationController({
      showPasswordInput: true,
      isConfirming: true,
      passwordError: 'Wrong password',
      noVotingPasswordSettingsHref: '/settings',
    });
    render(<AccreditationSectionView controller={controller} />);
    expect(mocks.passwordInput).toHaveBeenCalledWith(
      expect.objectContaining({
        onSubmit: controller.handlePasswordSubmit,
        error: 'Wrong password',
        noVotingPasswordSettingsHref: '/settings',
        isLoading: true,
      })
    );
  });

  it('renders participant initials and dispatches accreditation management', () => {
    const controller = accreditationController({
      canManageAccreditations: true,
      accreditationsByAgendaItem: [
        { id: 'pending', user_id: 'alice', status: 'pending' },
        { id: 'approved', user_id: null, status: 'approved' },
      ],
    });
    const { container } = render(<AccreditationSectionView controller={controller} />);
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('?');

    fireEvent.click(
      container.querySelector('[data-action-id="agendas.accreditation.request.approve"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="agendas.accreditation.request.reject"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="agendas.accreditation.approval.revoke"]')!
    );
    expect(controller.approveAccreditation).toHaveBeenCalledWith({ accreditation_id: 'pending' });
    expect(controller.rejectAccreditation).toHaveBeenCalledWith({ accreditation_id: 'pending' });
    expect(controller.revokeAccreditation).toHaveBeenCalledWith({ accreditation_id: 'approved' });
  });

  it('hides accreditation actions from non-managers', () => {
    const controller = accreditationController({
      accreditationsByAgendaItem: [{ id: 'pending', user_id: 'alice', status: 'pending' }],
    });
    const { container } = render(<AccreditationSectionView controller={controller} />);
    expect(container.querySelector('[data-action-id*="accreditation.request"]')).toBeNull();
  });

  it.each([
    ['complete', true],
    ['incomplete', false],
  ])('renders a %s CR timeline', (_label, isTimelineComplete) => {
    const currentItem = { id: 'cr-current' };
    render(
      <AgendaCRVoteTimelineView
        agendaItemId="agenda-1"
        allCRsProcessed={false}
        canManage
        canVote
        castCRVote={vi.fn()}
        closeVoting={vi.fn()}
        completedItems={[{ id: 'done' }]}
        crTimeline={[
          { id: 'cr-current', is_closing_vote: true },
          { id: 'cr-other', is_closing_vote: false },
        ]}
        currentItem={currentItem}
        getUserSelectedChoiceIds={vi.fn(() => ['choice-1'])}
        hasUserVoted={vi.fn(() => true)}
        isLoading={false}
        isTimelineComplete={isTimelineComplete}
        progress={0.5}
        progressPercent={50}
        startFinalPhase={vi.fn()}
        startIndicativePhase={vi.fn()}
        t={(key: string) => key}
        userId="user-1"
      />
    );
    expect(mocks.timelineCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ isCurrent: true, isFinalVoteLocked: true })
    );
    expect(mocks.timelineCard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ isCurrent: false, isFinalVoteLocked: false })
    );
  });

  it('unlocks the closing CR once all requests are processed and handles no current item', () => {
    render(
      <AgendaCRVoteTimelineView
        agendaItemId="agenda-1"
        allCRsProcessed
        canManage={false}
        canVote={false}
        castCRVote={vi.fn()}
        closeVoting={vi.fn()}
        completedItems={[]}
        crTimeline={[{ id: 'closing', is_closing_vote: true }]}
        currentItem={null}
        getUserSelectedChoiceIds={vi.fn(() => [])}
        hasUserVoted={vi.fn(() => false)}
        isLoading={false}
        isTimelineComplete={false}
        progress={0}
        progressPercent={0}
        startFinalPhase={vi.fn()}
        startIndicativePhase={vi.fn()}
        t={(key: string) => key}
        userId={undefined}
      />
    );
    expect(mocks.timelineCard).toHaveBeenCalledWith(
      expect.objectContaining({ isCurrent: false, isFinalVoteLocked: false })
    );
  });
});
