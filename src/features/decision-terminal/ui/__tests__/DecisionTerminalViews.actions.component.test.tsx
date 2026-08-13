/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CollapsibleSectionView,
  DecisionSummaryCompactView,
  DecisionSummaryView,
} from '../DecisionSummaryView';
import { DecisionRowView } from '../DecisionRowView';
import { DecisionVoteButtonView } from '../DecisionVoteButtonView';
import { TerminalHeaderView } from '../TerminalHeaderView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  DecisionStatusBadge: () => <span>Status</span>,
}));
vi.mock('@/features/shared/ui/voting', () => ({
  DecisionResultCompact: () => <span>Result</span>,
}));
vi.mock('../CountdownTimer', () => ({
  CountdownTimer: () => <span>Timer</span>,
  EndedAgo: () => <span>Ended</span>,
}));
vi.mock('../VoteProgressBar', () => ({
  CandidateBarCompact: () => null,
  VoteBarCompact: () => null,
}));
vi.mock('../TrendIndicator', () => ({ TrendIndicator: () => null }));

afterEach(cleanup);

describe('decision terminal view action contracts', () => {
  it('navigates row context and decision links through stable intents', () => {
    const decision = {
      id: 'V-1',
      type: 'vote',
      sourceId: 'vote-1',
      title: 'Budget vote',
      body: 'Assembly',
      href: '/event/event-1/agenda/agenda-1',
      entity: { name: 'Budget amendment', href: '/amendment/amendment-1' },
      agendaItem: { name: 'Agenda item', href: '/event/event-1/agenda/agenda-2' },
      summary: null,
      isClosed: true,
      endsAt: new Date(),
      status: 'passed',
      trend: { direction: 'stable', percentage: 0 },
    };
    const view = render(
      <DecisionRowView
        decision={decision}
        t={(key: string) => key}
        isFlashing={false}
        setIsFlashing={vi.fn()}
        prevTrendRef={{ current: null }}
        electionBarData={null}
        gridColumnsClass="grid-cols-8"
        Icon={() => null}
      />
    );

    expect(
      document
        .querySelector('[data-action-id="decision-terminal.row.entity.open"]')
        ?.getAttribute('href')
    ).toBe('/amendment/amendment-1');
    expect(
      document
        .querySelector('[data-action-id="decision-terminal.row.agenda-item.open"]')
        ?.getAttribute('href')
    ).toBe('/event/event-1/agenda/agenda-2');
    const decisionLinks = document.querySelectorAll(
      '[data-action-id="decision-terminal.row.decision.open"]'
    );
    expect(decisionLinks).toHaveLength(2);
    expect(decisionLinks[0]?.getAttribute('href')).toBe('/event/event-1/agenda/agenda-1');

    view.rerender(
      <DecisionRowView
        decision={{ ...decision, entity: null, agendaItem: null }}
        t={(key: string) => key}
        isFlashing={false}
        setIsFlashing={vi.fn()}
        prevTrendRef={{ current: null }}
        electionBarData={null}
        gridColumnsClass="grid-cols-8"
        Icon={() => null}
      />
    );
    expect(
      document.querySelector('[data-action-id="decision-terminal.row.entity.open"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-action-id="decision-terminal.row.agenda-item.open"]')
    ).toBeNull();
  });

  it('dispatches all summary expansion intents', () => {
    const onToggle = vi.fn();
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    const view = render(
      <CollapsibleSectionView
        section={{ type: 'summary', title: 'Summary', content: 'Content' }}
        isCollapsed={false}
        onToggle={onToggle}
        maxContentHeight={100}
        contentRef={{ current: null }}
        needsCollapse={false}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="decision-terminal.summary.section.toggle"]')!
    );
    expect(onToggle).toHaveBeenCalledOnce();

    view.rerender(
      <DecisionSummaryView
        sections={[]}
        maxContentHeight={100}
        labels={{ details: 'Details', expandAll: 'Expand all', collapseAll: 'Collapse all' }}
        collapsedSections={new Set()}
        onToggleSection={vi.fn()}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        allCollapsed={false}
        allExpanded={false}
        renderSection={() => null}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="decision-terminal.summary.expand-all"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="decision-terminal.summary.collapse-all"]')!
    );
    expect(onExpandAll).toHaveBeenCalledOnce();
    expect(onCollapseAll).toHaveBeenCalledOnce();

    view.rerender(
      <DecisionSummaryCompactView
        summary={'A'.repeat(151)}
        isExpanded={false}
        onToggle={onToggle}
        labels={{ showLess: 'Less', readMore: 'More' }}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="decision-terminal.summary.compact.toggle"]')!
    );
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('dispatches vote and result intents across decision states', () => {
    const onVote = vi.fn();
    const baseDecision = {
      href: '/event/event-1/agenda/agenda-1',
      eventId: 'event-1',
      canOpenVoteDialog: true,
      isClosed: false,
    };
    const view = render(
      <DecisionVoteButtonView
        decision={baseDecision}
        compact={false}
        onVote={onVote}
        canVote={() => true}
        isLoading={false}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="decision-terminal.vote.cast"]')!);
    expect(onVote).toHaveBeenCalledWith(baseDecision);

    view.rerender(
      <DecisionVoteButtonView
        decision={{ ...baseDecision, isClosed: true }}
        compact={false}
        onVote={onVote}
        canVote={() => true}
        isLoading={false}
      />
    );
    expect(
      document
        .querySelector('[data-action-id="decision-terminal.vote.results.open"]')
        ?.getAttribute('href')
    ).toBe('/event/event-1/agenda/agenda-1');
  });

  it('dispatches terminal type, visibility, and search filters through stable intents', () => {
    const onFilterChange = vi.fn();
    const onVisibilityFilterChange = vi.fn();
    const onShowSearch = vi.fn();
    const onSearchChange = vi.fn();
    const onSearchBlur = vi.fn();
    const view = render(
      <TerminalHeaderView
        activeFilter="all"
        onFilterChange={onFilterChange}
        onVisibilityFilterChange={onVisibilityFilterChange}
        searchQuery=""
        onSearchChange={onSearchChange}
        urgentCount={1}
        activeCount={2}
        showSearch={false}
        filters={[{ value: 'live', label: 'Live' }]}
        visibilityLabel="Visibility"
        labels={{
          title: 'Terminal',
          urgent: 'urgent',
          active: 'active',
          all: 'All',
          public: 'Public',
          authenticated: 'Authenticated',
          private: 'Private',
          searchPlaceholder: 'Search',
          density: 'Density',
          refreshRate: 'Refresh',
          soundAlerts: 'Sound',
        }}
        onShowSearch={onShowSearch}
        onSearchBlur={onSearchBlur}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="decision-terminal.header.type-filter.select"]')!
    );
    for (const id of ['all', 'public', 'authenticated', 'private']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="decision-terminal.header.visibility.${id}"]`)!
      );
    }
    const search = document.querySelector(
      '[data-action-id="decision-terminal.header.search.open"]'
    ) as HTMLElement;
    search.focus();
    fireEvent.click(search);
    expect(onFilterChange).toHaveBeenCalledWith('live');
    expect(onVisibilityFilterChange.mock.calls.map(call => call[0])).toEqual([
      'all',
      'public',
      'authenticated',
      'private',
    ]);
    expect(onShowSearch).toHaveBeenCalledOnce();
    expect(
      document.querySelector('[data-action-id="decision-terminal.header.visibility.open"]')
    ).toBeTruthy();

    view.rerender(
      <TerminalHeaderView
        activeFilter="all"
        onFilterChange={onFilterChange}
        onVisibilityFilterChange={onVisibilityFilterChange}
        searchQuery="budget"
        onSearchChange={onSearchChange}
        urgentCount={0}
        activeCount={0}
        showSearch
        filters={[]}
        visibilityLabel="Visibility"
        labels={{
          title: 'Terminal',
          urgent: 'urgent',
          active: 'active',
          all: 'All',
          public: 'Public',
          authenticated: 'Authenticated',
          private: 'Private',
          searchPlaceholder: 'Search',
          density: 'Density',
          refreshRate: 'Refresh',
          soundAlerts: 'Sound',
        }}
        onShowSearch={onShowSearch}
        onSearchBlur={onSearchBlur}
      />
    );
    const input = document.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agenda' } });
    fireEvent.blur(input);
    expect(onSearchChange).toHaveBeenCalledWith('agenda');
    expect(onSearchBlur).toHaveBeenCalledOnce();
  });
});
