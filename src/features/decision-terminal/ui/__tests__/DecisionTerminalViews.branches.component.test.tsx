/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CountdownTimerView, EndedAgoView } from '../CountdownTimerView';
import { DecisionDashboardHeader } from '../DecisionDashboardHeader';
import { DecisionRowView } from '../DecisionRowView';
import { CollapsibleSectionView } from '../DecisionSummaryView';
import { DecisionVoteButtonView } from '../DecisionVoteButtonView';
import { DecisionWidgetContent } from '../DecisionWidgetContent';
import { DecisionWidgetFrame } from '../DecisionWidgetFrame';
import { MobileDecisionCard, MobileElectionCandidateRows } from '../MobileDecisionCard';
import { TerminalHeader } from '../TerminalHeader';
import { TerminalHeaderView } from '../TerminalHeaderView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityLocalListView: ({ items, renderItem }: any) => (
    <div data-testid="local-list">
      {items.map((item: any) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/elections/logic/electionAssignmentMetadata', () => ({
  stripDelegateElectionMetadata: (value: string | null | undefined) => value ?? '',
}));

vi.mock('../CountdownTimer', () => ({
  CountdownTimer: ({ compactLabel }: any) => <span data-testid="countdown">{compactLabel}</span>,
  EndedAgo: () => <span data-testid="ended-ago">ended</span>,
}));

vi.mock('../DecisionVoteButton', () => ({
  DecisionVoteButton: ({ decision, onVote }: any) => (
    <button type="button" data-testid="widget-vote" onClick={() => onVote(decision)}>
      vote
    </button>
  ),
}));

vi.mock('../VoteProgressBar', () => ({
  CandidateBarCompact: () => <div data-testid="candidate-bar" />,
  VoteBarCompact: () => <div data-testid="vote-bar" />,
}));

vi.mock('../TrendIndicator', () => ({
  TrendIndicator: () => <div data-testid="trend" />,
}));

vi.mock('@/features/shared/ui/status', async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    DecisionStatusBadge: ({ status }: any) => <span data-testid="status">{status}</span>,
  };
});

vi.mock('@/features/shared/ui/voting', () => ({
  DecisionResultCompact: ({ result, winnerName }: any) => (
    <span data-testid="result-compact">
      {result}:{winnerName}
    </span>
  ),
  DecisionResultBadge: ({ result, winnerName }: any) => (
    <span data-testid="result-badge">
      {result}:{winnerName}
    </span>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const baseDecision = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'D-1',
    sourceId: 'source-1',
    type: 'vote',
    title: 'Budget vote',
    body: 'Assembly',
    href: '/decision/1',
    endsAt: new Date('2026-01-02T00:00:00.000Z'),
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'active',
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    isClosed: false,
    ...overrides,
  }) as any;

const electionCandidates = [
  {
    id: 'candidate-1',
    name: 'Ada Lovelace',
    votes: 3,
    indicationVotes: 1,
    actualPercentage: 75,
    indicationPercentage: 25,
    isWinner: true,
  },
  {
    id: 'candidate-2',
    name: 'Grace Hopper',
    votes: 1,
    indicationVotes: 3,
    isWinner: false,
  },
];

describe('small decision terminal views', () => {
  it('renders every countdown urgency, compact shape, expiry, and ended label state', () => {
    const base = {
      showIcon: true,
      compact: false,
      timeRemaining: { isExpired: false },
      formattedTime: '01:00',
      urgency: 'normal',
      labels: { ended: 'Ended' },
    };
    const { rerender, container } = render(<CountdownTimerView {...base} />);
    for (const urgency of ['critical', 'urgent', 'closing', 'normal']) {
      rerender(<CountdownTimerView {...base} urgency={urgency} />);
    }
    rerender(<CountdownTimerView {...base} showIcon={false} />);
    rerender(<CountdownTimerView {...base} compact compactLabel="Starts" />);
    expect(screen.getByText('Starts')).toBeTruthy();
    rerender(<CountdownTimerView {...base} compact />);
    expect(screen.queryByText('Starts')).toBeNull();
    rerender(<CountdownTimerView {...base} timeRemaining={{ isExpired: true }} />);
    expect(screen.getByText('Ended')).toBeTruthy();
    rerender(<EndedAgoView label={null} />);
    expect(container.firstElementChild).toBeNull();
    rerender(<EndedAgoView label="one minute ago" />);
    expect(screen.getByText('one minute ago')).toBeTruthy();
  });

  it('covers dashboard, widget-frame, vote-button, and terminal header variants', () => {
    const onSearchChange = vi.fn();
    const onResetLayout = vi.fn();
    const { rerender, container } = render(
      <DecisionDashboardHeader
        searchQuery=""
        onSearchChange={onSearchChange}
        onResetLayout={onResetLayout}
        urgentCount={0}
        activeCount={1}
      />
    );
    fireEvent.change(container.querySelector('input')!, { target: { value: 'budget' } });
    fireEvent.click(screen.getByTestId('decision-terminal-reset-layout'));
    expect(onSearchChange).toHaveBeenCalledWith('budget');
    expect(onResetLayout).toHaveBeenCalled();

    rerender(<DecisionWidgetFrame title="Widget">Body</DecisionWidgetFrame>);
    expect(screen.queryByText('0')).toBeNull();

    const decision = baseDecision({ canOpenVoteDialog: true, eventId: 'event-1' });
    const onVote = vi.fn();
    rerender(
      <DecisionVoteButtonView
        decision={decision}
        compact
        onVote={onVote}
        canVote={() => true}
        isLoading
      />
    );
    rerender(
      <DecisionVoteButtonView
        decision={decision}
        compact={false}
        onVote={onVote}
        canVote={() => true}
        isLoading
      />
    );
    rerender(
      <DecisionVoteButtonView
        decision={decision}
        compact={false}
        onVote={onVote}
        canVote={() => false}
        isLoading={false}
      />
    );
    expect(container.firstElementChild).toBeNull();
    rerender(
      <DecisionVoteButtonView
        decision={decision}
        compact
        onVote={onVote}
        canVote={() => true}
        isLoading={false}
      />
    );
    fireEvent.click(container.querySelector('[data-action-id="decision-terminal.vote.cast"]')!);
    expect(onVote).toHaveBeenCalledWith(decision);

    rerender(
      <TerminalHeader
        activeFilter="all"
        onFilterChange={vi.fn()}
        visibilityFilter="all"
        onVisibilityFilterChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(document.body.textContent).toContain('0');

    rerender(
      <TerminalHeaderView
        activeFilter="live"
        onFilterChange={vi.fn()}
        onVisibilityFilterChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        urgentCount={0}
        activeCount={0}
        showSearch={false}
        filters={[
          { value: 'live', label: 'Live' },
          { value: 'all', label: 'All' },
        ]}
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
        onShowSearch={vi.fn()}
        onSearchBlur={vi.fn()}
      />
    );
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('renders collapsed, height-limited, and expanded summary sections', () => {
    const contentRef = { current: null };
    const props = {
      section: { type: 'summary' as const, title: 'Summary', content: 'Content' },
      onToggle: vi.fn(),
      maxContentHeight: 100,
      contentRef,
    };
    const { rerender, container } = render(
      <CollapsibleSectionView {...props} isCollapsed needsCollapse />
    );
    expect(container.querySelector('[aria-expanded="false"]')).toBeTruthy();
    rerender(<CollapsibleSectionView {...props} isCollapsed={false} needsCollapse />);
    expect(
      Array.from(container.querySelectorAll('div')).some(element =>
        element.classList.contains('max-h-[500px]')
      )
    ).toBe(true);
    rerender(<CollapsibleSectionView {...props} isCollapsed={false} needsCollapse={false} />);
    expect(
      Array.from(container.querySelectorAll('div')).some(element =>
        element.classList.contains('max-h-[2000px]')
      )
    ).toBe(true);
  });
});

describe('DecisionRowView branch matrix', () => {
  const common = {
    t: (key: string) => key,
    setIsFlashing: vi.fn(),
    prevTrendRef: { current: 0 },
    gridColumnsClass: 'grid-cols-7',
    Icon: () => <span>icon</span>,
  };

  it('renders vote, election, timing, result, and vote-data variants', () => {
    const { rerender, container } = render(
      <DecisionRowView
        {...common}
        decision={baseDecision({ href: '#', summary: 'Summary' })}
        isFlashing
        electionBarData={null}
      />
    );
    expect(screen.getByTestId('vote-row')).toBeTruthy();

    rerender(
      <DecisionRowView
        {...common}
        decision={baseDecision({ type: 'election', isOpeningSoon: true, sourceId: 'election-1' })}
        isFlashing={false}
        electionBarData={{ totalSelections: 4, candidates: [{ id: 'a', label: 'Ada', value: 4 }] }}
      />
    );
    expect(screen.getByTestId('election-row').dataset.electionId).toBe('election-1');

    rerender(
      <DecisionRowView
        {...common}
        decision={baseDecision({ type: 'election', isIndicationPhase: true })}
        isFlashing={false}
        electionBarData={{ totalSelections: 0, candidates: [{ id: 'a', label: 'Ada', value: 0 }] }}
      />
    );
    rerender(
      <DecisionRowView
        {...common}
        decision={baseDecision({
          isIndicationPhase: true,
          votes: { support: 9, oppose: 9, abstain: 9 },
          indicationVotes: { support: 2, oppose: 1, abstain: 0 },
        })}
        isFlashing={false}
        electionBarData={null}
      />
    );
    expect(document.body.textContent).toContain('2/1/0');

    rerender(
      <DecisionRowView
        {...common}
        decision={baseDecision({
          isIndicationPhase: false,
          votes: { support: 3, oppose: 2, abstain: 1 },
          indicationVotes: { support: 2, oppose: 1, abstain: 0 },
        })}
        isFlashing={false}
        electionBarData={null}
      />
    );
    expect(document.body.textContent).toContain('3/2/1');

    rerender(
      <DecisionRowView
        {...common}
        decision={baseDecision({
          votes: { support: 1, oppose: 0, abstain: 0 },
          indicationVotes: undefined,
        })}
        isFlashing={false}
        electionBarData={null}
      />
    );

    rerender(
      <DecisionRowView
        {...common}
        decision={baseDecision({ isClosed: true, supportPercentage: 55, winnerName: 'Ada' })}
        isFlashing={false}
        electionBarData={null}
      />
    );
    expect(screen.getByText('55%')).toBeTruthy();
    expect(container.querySelector('[data-testid="ended-ago"]')).toBeTruthy();
  });
});

describe('MobileDecisionCard branch matrix', () => {
  it('renders candidate, indication toggle, vote, timing, and action variants', () => {
    const onClick = vi.fn();
    const { rerender, container } = render(
      <MobileDecisionCard
        decision={baseDecision({
          type: 'election',
          sourceId: 'election-1',
          isClosed: true,
          status: 'elected',
          winnerName: 'Ada Lovelace',
          candidates: electionCandidates,
        })}
        onClick={onClick}
      />
    );
    const toggle = container.querySelector<HTMLElement>(
      '[data-action-id="decision-terminal.mobile.indication-results.toggle"]'
    )!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(
      container.querySelector<HTMLElement>(
        '[data-action-id="decision-terminal.mobile.decision.open"]'
      )!
    );
    expect(onClick).toHaveBeenCalled();

    rerender(
      <MobileDecisionCard
        decision={baseDecision({
          type: 'election',
          isIndicationPhase: true,
          isUrgent: true,
          candidates: electionCandidates,
        })}
        onClick={onClick}
      />
    );
    expect(screen.getByTestId('trend')).toBeTruthy();

    rerender(
      <MobileDecisionCard
        decision={baseDecision({
          isOpeningSoon: true,
          isIndicationPhase: true,
          votes: { support: 9, oppose: 9, abstain: 9 },
          indicationVotes: { support: 2, oppose: 1, abstain: 0 },
        })}
        onClick={onClick}
      />
    );
    expect(document.body.textContent).toContain('2/1/0');

    rerender(
      <MobileDecisionCard decision={baseDecision({ body: '', votes: null })} onClick={onClick} />
    );
    expect(screen.getByText('features.timeline.terminal.castVote')).toBeTruthy();

    rerender(
      <MobileDecisionCard
        decision={baseDecision({ isClosed: true, status: 'passed', winnerName: 'Winner' })}
        onClick={onClick}
      />
    );
    expect(screen.getByTestId('result-badge').textContent).toContain('Winner');

    rerender(
      <MobileElectionCandidateRows decision={baseDecision({ type: 'election', candidates: [] })} />
    );
    expect(container.firstElementChild).toBeNull();
  });
});

describe('DecisionWidgetContent branch matrix', () => {
  const widget = { id: 'widget-1', title: 'Decisions' } as any;

  it('renders loading, empty, rich decisions, and live delta replacements', () => {
    vi.useFakeTimers();
    const onVoteDecision = vi.fn();
    const { rerender, container, unmount } = render(
      <DecisionWidgetContent
        widget={widget}
        decisions={[]}
        isLoading
        onVoteDecision={onVoteDecision}
      />
    );
    expect(container.querySelectorAll('.h-24')).toHaveLength(5);
    rerender(
      <DecisionWidgetContent widget={widget} decisions={[]} onVoteDecision={onVoteDecision} />
    );
    expect(document.body.textContent).toContain('No matching decisions.');

    const decisions = [
      baseDecision({ id: 'empty', href: '#', body: '', summary: '', votes: null }),
      baseDecision({
        id: 'entity-only',
        body: '',
        entity: { id: 'entity-2', name: 'Only entity', href: '#' },
        votes: { support: 0, oppose: 0, abstain: 0 },
      }),
      baseDecision({
        id: 'indication',
        body: ' Assembly ',
        summary: ' Summary ',
        entity: { id: 'entity-1', name: 'Entity', href: '/entity/1' },
        agendaItem: { id: 'agenda-1', name: 'Agenda', href: '/agenda/1' },
        isIndicationPhase: true,
        phase: 'indication',
        votedCount: 3,
        totalMembers: 4,
        turnout: 75,
        votes: { support: 9, oppose: 9, abstain: 9 },
        indicationVotes: { support: 1, oppose: 1, abstain: 0 },
        canOpenVoteDialog: true,
        isUrgent: true,
      }),
      baseDecision({
        id: 'closed',
        isClosed: true,
        status: 'failed',
        phase: 'final',
        winnerName: 'Winner',
        votes: { support: 3, oppose: 4, abstain: 1 },
        choices: [
          { id: 'support', label: 'Support custom' },
          { id: 'oppose', label: 'Oppose custom' },
          { id: 'abstain', label: 'Abstain custom' },
        ],
      }),
      baseDecision({ id: 'future', isFutureDecision: true, startsAt: new Date(), votes: null }),
      baseDecision({
        id: 'election-empty',
        type: 'election',
        candidates: [],
        votes: null,
      }),
      baseDecision({
        id: 'election-rich',
        type: 'election',
        isClosed: true,
        status: 'elected',
        winnerName: 'Grace Hopper',
        candidates: electionCandidates,
        votes: null,
      }),
    ];
    rerender(
      <DecisionWidgetContent
        widget={widget}
        decisions={decisions}
        onVoteDecision={onVoteDecision}
      />
    );
    fireEvent.click(screen.getByTestId('widget-vote'));
    expect(onVoteDecision).toHaveBeenCalled();

    const changed = decisions.map(item =>
      item.id === 'indication'
        ? { ...item, indicationVotes: { support: 2, oppose: 2, abstain: 1 } }
        : item.id === 'closed'
          ? { ...item, votes: { support: 4, oppose: 5, abstain: 2 } }
          : item.id === 'election-rich'
            ? {
                ...item,
                candidates: [
                  ...item.candidates,
                  { id: 'candidate-new', name: 'New Candidate', votes: 1, indicationVotes: 0 },
                ],
              }
            : item
    );
    rerender(
      <DecisionWidgetContent widget={widget} decisions={changed} onVoteDecision={onVoteDecision} />
    );
    expect(document.body.textContent).toContain('+1');
    const changedAgain = changed.map(item =>
      item.id === 'closed' ? { ...item, votes: { support: 5, oppose: 6, abstain: 3 } } : item
    );
    rerender(
      <DecisionWidgetContent
        widget={widget}
        decisions={changedAgain}
        onVoteDecision={onVoteDecision}
      />
    );
    act(() => vi.advanceTimersByTime(1_800));
    unmount();
  });
});
