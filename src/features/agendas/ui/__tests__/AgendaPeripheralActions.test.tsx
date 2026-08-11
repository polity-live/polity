/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vote } from 'lucide-react';

import { AgendaEntityBadgeView } from '../AgendaBadgesView';
import { AgendaCard } from '../AgendaCard';
import { AgendaItemContextCardView } from '../AgendaItemContextCardView';
import { AgendaNavigationControlsView } from '../AgendaNavigationControlsView';
import { ElectionDetailsSectionView } from '../ElectionDetailsSectionView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => {
    const href = Object.entries(params ?? {}).reduce(
      (path, [key, value]) => path.replace(`$${key}`, value),
      to
    );
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({
    children,
    href,
    label,
  }: {
    children: ReactNode;
    href: string;
    label: string;
  }) => (
    <a href={href} aria-label={label}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, values?: { title?: string }) => values?.title ?? key,
  }),
}));

vi.mock('@/features/amendments/ui/AmendmentProcessDetailsPanel', () => ({
  AmendmentProcessDetailsPanel: () => <div />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('agenda peripheral action contracts', () => {
  it('dispatches previous, complete, and next navigation through stable async actions', () => {
    const previous = vi.fn();
    const complete = vi.fn();
    const next = vi.fn();

    const { container } = render(
      <AgendaNavigationControlsView
        canNavigate
        completeCurrentItem={complete}
        currentAgendaItem={{ title: 'Budget', status: 'in-progress' }}
        currentIndex={1}
        eventId="event-1"
        hasNextItem
        hasPreviousItem
        isLoading={false}
        moveToNextItem={next}
        moveToPreviousItem={previous}
        progressPercentage={50}
        t={(key: string) => key}
        totalItems={4}
      />
    );

    for (const [id, effect] of [
      ['agendas.navigation.previous', previous],
      ['agendas.navigation.complete', complete],
      ['agendas.navigation.next', next],
    ] as const) {
      const action = container.querySelector<HTMLElement>(`[data-action-id="${id}"]`)!;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
      expect(effect).toHaveBeenCalledTimes(1);
    }
  });

  it('opens the move-event flow without activating the agenda-card navigation surface', () => {
    const onMoveClick = vi.fn();
    const { container } = render(
      <AgendaCard
        id="agenda-1"
        title="Budget"
        type="discussion"
        status="pending"
        detailsLink="/event/event-1/agenda/agenda-1"
        showMoveButton
        onMoveClick={onMoveClick}
      />
    );

    const action = container.querySelector<HTMLElement>(
      '[data-action-id="agendas.card.move-event.open"]'
    )!;
    fireEvent.click(action);
    expect(onMoveClick).toHaveBeenCalledTimes(1);
  });

  it('navigates from an entity badge through a stable deep link', () => {
    const { container } = render(
      <AgendaEntityBadgeView
        label="Budget motion"
        href="/amendment/amendment-1"
        status="active"
        tone="info"
        Icon={Vote}
      />
    );

    const action = container.querySelector<HTMLAnchorElement>(
      '[data-action-id="agendas.badge.entity.navigate"]'
    )!;
    expect(action.getAttribute('href')).toBe('/amendment/amendment-1');
    action.focus();
    expect(document.activeElement).toBe(action);
  });

  it('navigates from the context-card header with click and keyboard semantics', () => {
    const navigateToAgendaDetail = vi.fn();
    const { container } = render(
      <AgendaItemContextCardView
        agendaItem={{ title: 'Budget', description: '', type: 'vote', status: 'pending' }}
        amendment={{ id: 'amendment-1', title: 'Budget motion' }}
        amendmentForwardingPreview={null}
        amendmentPathVisualizationData={null}
        amendmentGroupTypeById={{}}
        onAmendmentGroupClick={vi.fn()}
        onAmendmentEventClick={vi.fn()}
        election={null}
        votingStartTime={null}
        votingEndTime={null}
        showHeaderStatusBadge={false}
        agendaDetailLink={{ eventId: 'event-1', agendaItemId: 'agenda-1' }}
        className=""
        presentation="standalone"
        t={(key: string) => key}
        i18n={{}}
        navigate={vi.fn()}
        locale={{} as never}
        TypeIcon={Vote}
        gradientClass=""
        durationMinutes={10}
        estimatedDurationMinutes={10}
        scheduledAt={null}
        actualStartedAt={null}
        actualCompletedAt={null}
        estimatedStartedAt={null}
        estimatedCompletedAt={null}
        estimatedOngoingCompletedAt={null}
        isCompleted={false}
        isOngoing={false}
        now={Date.now()}
        hasAgendaDetailLink
        formatRelativeTime={vi.fn()}
        navigateToAgendaDetail={navigateToAgendaDetail}
        electionDetailsController={{}}
      />
    );

    const action = container.querySelector<HTMLElement>(
      '[data-action-id="agendas.context-card.detail.navigate"]'
    )!;
    fireEvent.click(action);
    fireEvent.keyDown(action, { key: 'Enter' });
    fireEvent.keyDown(action, { key: ' ' });
    expect(navigateToAgendaDetail).toHaveBeenCalledTimes(3);
    expect(
      container
        .querySelector<HTMLAnchorElement>(
          '[data-action-id="agendas.context-card.detail.navigate"][href]'
        )
        ?.getAttribute('href')
    ).toBe('/event/event-1/agenda/agenda-1');
  });

  it('opens the amendment deep link when no agenda-detail link is available', () => {
    const { container } = render(
      <AgendaItemContextCardView
        agendaItem={{ title: 'Budget', description: '', type: 'vote', status: 'pending' }}
        amendment={{ id: 'amendment-1', title: 'Budget motion' }}
        amendmentForwardingPreview={null}
        amendmentPathVisualizationData={null}
        amendmentGroupTypeById={{}}
        onAmendmentGroupClick={vi.fn()}
        onAmendmentEventClick={vi.fn()}
        election={null}
        votingStartTime={null}
        votingEndTime={null}
        showHeaderStatusBadge={false}
        agendaDetailLink={null}
        className=""
        presentation="standalone"
        t={(key: string) => key}
        i18n={{}}
        navigate={vi.fn()}
        locale={{} as never}
        TypeIcon={Vote}
        gradientClass=""
        durationMinutes={10}
        estimatedDurationMinutes={10}
        scheduledAt={null}
        actualStartedAt={null}
        actualCompletedAt={null}
        estimatedStartedAt={null}
        estimatedCompletedAt={null}
        estimatedOngoingCompletedAt={null}
        isCompleted={false}
        isOngoing={false}
        now={Date.now()}
        hasAgendaDetailLink={false}
        formatRelativeTime={vi.fn()}
        navigateToAgendaDetail={vi.fn()}
        electionDetailsController={{}}
      />
    );

    const action = container.querySelector<HTMLAnchorElement>(
      '[data-action-id="agendas.context-card.amendment.navigate"]'
    )!;
    expect(action.getAttribute('href')).toBe('/amendment/amendment-1');
    action.focus();
    expect(document.activeElement).toBe(action);
  });

  it('toggles election role details with focusable selection semantics', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <ElectionDetailsSectionView
        election={{ role: { id: 'role-1', title: 'Chair', group: null } }}
        open={false}
        onOpenChange={onOpenChange}
        labels={{
          roleDetails: 'Role details',
          viewGroup: 'View group',
          role: 'Role',
          description: 'Description',
          term: 'Term',
        }}
      />
    );

    const action = container.querySelector<HTMLElement>(
      '[data-action-id="agendas.election.role-details.toggle"]'
    )!;
    action.focus();
    fireEvent.click(action);
    expect(document.activeElement).toBe(action);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('renders expanded election metadata and a linked group', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <ElectionDetailsSectionView
        election={{
          election_mode: 'list',
          seat_count: 3,
          role: {
            id: 'role-1',
            title: 'Chair',
            description: 'Leads the board',
            term: '2 years',
            group: { id: 'group-1', name: 'Board' },
          },
        }}
        open
        onOpenChange={onOpenChange}
        labels={{
          roleDetails: 'Role details',
          viewGroup: 'View group',
          role: 'Role',
          description: 'Description',
          term: 'Term',
        }}
      />
    );
    expect(screen.getByText('Leads the board')).toBeTruthy();
    expect(screen.getByText(/2 years/)).toBeTruthy();
    expect(screen.getAllByText('Board').length).toBeGreaterThan(0);
    const groupLink = container.querySelector('a')!;
    expect(groupLink.getAttribute('href')).toBe('/group/group-1');
    fireEvent.click(groupLink);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('uses the group-link fallback and omits absent role metadata', () => {
    const { rerender } = render(
      <ElectionDetailsSectionView
        election={{ role: { id: 'role-1', group: { id: 'group-1', name: null } } }}
        open
        onOpenChange={vi.fn()}
        labels={{
          roleDetails: 'Role details',
          viewGroup: 'View group',
          role: 'Role',
          description: 'Description',
          term: 'Term',
        }}
      />
    );
    expect(screen.getByRole('link', { name: /View group/ })).toBeTruthy();

    rerender(
      <ElectionDetailsSectionView
        election={{ role: null }}
        open
        onOpenChange={vi.fn()}
        labels={{
          roleDetails: 'Role details',
          viewGroup: 'View group',
          role: 'Role',
          description: 'Description',
          term: 'Term',
        }}
      />
    );
    expect(screen.queryByText('View group')).toBeNull();
  });
});
