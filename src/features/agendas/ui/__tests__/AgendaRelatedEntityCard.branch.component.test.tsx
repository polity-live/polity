/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@/features/timeline/ui/cards/TimelineCardBase', () => ({
  TimelineCardBase: ({ children, href }: { children: ReactNode; href?: string }) => (
    <article data-testid="card" data-href={href}>
      {children}
    </article>
  ),
  TimelineCardHeader: ({
    children,
    title,
    subtitle,
    subtitleHref,
    badge,
  }: {
    children?: ReactNode;
    title: string;
    subtitle?: string;
    subtitleHref?: string;
    badge?: ReactNode;
  }) => (
    <header data-testid="header" data-subtitle={subtitle} data-subtitle-href={subtitleHref}>
      <h2>{title}</h2>
      {badge}
      {children}
    </header>
  ),
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
  TimelineCardContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TimelineCardStats: ({ stats }: { stats: { label: string; value: number }[] }) => (
    <div data-testid="stats">{stats.map(stat => `${stat.label}:${stat.value}`).join('|')}</div>
  ),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EditingModeBadge: ({ mode }: { mode: string }) => <span data-testid="editing-mode">{mode}</span>,
}));

import { AgendaRelatedAmendmentCard, AgendaRelatedRoleCard } from '../AgendaRelatedEntityCard';

afterEach(cleanup);

describe('AgendaRelatedEntityCard branches', () => {
  it('renders every amendment statistic, group link, reason, and branch badge', () => {
    render(
      <AgendaRelatedAmendmentCard
        amendment={{
          id: 'amendment-1',
          title: '  Budget reform  ',
          reason: '  Needed now  ',
          upvotes: 8,
          downvotes: 3,
          collaborator_count: 2,
          change_requests: [{ id: 'cr-1' }, { id: 'cr-2' }],
          group: { id: 'group-1', name: '  Assembly  ' },
          current_process_run: {
            branches: [{ id: 'branch-1', created_at: 1, editing_mode: 'suggest_event' }],
          },
        }}
      />
    );

    expect(screen.getByRole('heading').textContent).toContain('Budget reform');
    expect(screen.getByTestId('header').getAttribute('data-subtitle')).toBe('Assembly');
    expect(screen.getByTestId('header').getAttribute('data-subtitle-href')).toBe('/group/group-1');
    expect(screen.getByTestId('stats').textContent).toContain('collaborators:2');
    expect(screen.getByTestId('stats').textContent).toContain(
      'features.timeline.cards.amendment.changeRequests:2'
    );
    expect(screen.getByTestId('stats').textContent).toContain('support:5');
    expect(screen.getByText(/Needed now/)).toBeTruthy();
    expect(screen.getByTestId('editing-mode')).toBeTruthy();
  });

  it('uses amendment fallbacks and omits empty optional sections', () => {
    const { rerender } = render(
      <AgendaRelatedAmendmentCard
        amendment={{
          id: 'amendment-2',
          title: '   ',
          reason: null,
          upvotes: null,
          downvotes: null,
          collaborator_count: 0,
          change_requests: [],
          group: { id: '', name: '  ' },
          current_process_run: null,
        }}
      />
    );
    expect(screen.getByRole('heading').textContent).toBe(
      'features.timeline.contentTypes.amendment'
    );
    expect(screen.queryByTestId('stats')).toBeNull();
    expect(screen.queryByTestId('editing-mode')).toBeNull();
    expect(screen.getByTestId('header').getAttribute('data-subtitle')).toBeNull();
    expect(screen.getByTestId('header').getAttribute('data-subtitle-href')).toBeNull();

    rerender(
      <AgendaRelatedAmendmentCard
        amendment={{ id: 'amendment-3', upvotes: 1, downvotes: 3, group: null }}
      />
    );
    expect(screen.getByTestId('stats').textContent).toContain('support:-2');
  });

  it('renders complete role metadata and its group link', () => {
    render(
      <AgendaRelatedRoleCard
        role={{
          id: 'role-1',
          title: '  Chair  ',
          description: '  Leads meetings  ',
          term: '  Two years  ',
          group: { id: 'group-1', name: '  Board  ' },
        }}
      />
    );

    expect(screen.getByRole('heading').textContent).toContain('Chair');
    expect(screen.getByTestId('header').getAttribute('data-subtitle')).toBe('Board');
    expect(screen.getByTestId('header').getAttribute('data-subtitle-href')).toBe('/group/group-1');
    expect(screen.getByText(/Two years/)).toBeTruthy();
    expect(screen.getByText(/Leads meetings/)).toBeTruthy();
  });

  it('uses role fallbacks without group, term, or description', () => {
    render(
      <AgendaRelatedRoleCard
        role={{
          id: 'role-2',
          title: null,
          description: ' ',
          term: null,
          group: { id: '', name: null },
        }}
      />
    );

    expect(screen.getByRole('heading').textContent).toBe('features.events.agenda.role');
    expect(screen.getByTestId('header').getAttribute('data-subtitle')).toBeNull();
    expect(screen.getByTestId('header').getAttribute('data-subtitle-href')).toBeNull();
    expect(document.body.textContent).toContain('features.events.agenda.electionFor');
  });
});
