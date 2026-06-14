/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode, Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DECISION_TERMINAL_DASHBOARD_VERSION,
  createDefaultDecisionTerminalDashboardConfig,
} from '../../logic/dashboard-config';
import { DecisionTerminal } from '../DecisionTerminal';
import type { DecisionItem } from '../types';
import { Button } from '@/features/shared/ui/ui/button';

const { saveDecisionTerminalDashboard, canVote } = vi.hoisted(() => ({
  saveDecisionTerminalDashboard: vi.fn(),
  canVote: vi.fn(() => true),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string } | string) =>
      typeof options === 'string' ? options : (options?.defaultValue ?? _key),
  }),
  translate: (_key: string, options?: { defaultValue?: string } | string) =>
    typeof options === 'string' ? options : (options?.defaultValue ?? _key),
}));

vi.mock('@/zero/preferences', async importOriginal => {
  const actual = await importOriginal<typeof import('@/zero/preferences')>();
  return {
    ...actual,
    usePreferenceState: () => ({
      decisionTerminalDashboard: null,
      isLoading: false,
    }),
    usePreferenceActions: () => ({
      saveDecisionTerminalDashboard,
    }),
  };
});

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({
    isLoading: false,
    canVote,
  }),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/features/vote-cast/hooks/useVoteCasting', () => ({
  useVoteCasting: () => ({
    phase: 'indication',
    isLoading: false,
    castAmendmentVote: vi.fn(),
    castElectionVote: vi.fn(),
  }),
}));

vi.mock('@/features/vote-cast/ui/VoteCastDialog', () => ({
  VoteCastDialog: ({ open, title }: { open: boolean; title?: string }) =>
    open ? <div data-testid="vote-dialog">Vote dialog: {title}</div> : null,
}));

vi.mock('react-grid-layout/legacy', () => {
  const dragStopLayout = [
    { i: 'widget-live-decisions', x: 1, y: 0, w: 5, h: 9 },
    { i: 'widget-my-vote-queue', x: 6, y: 0, w: 6, h: 9 },
    { i: 'widget-closing-soon', x: 0, y: 9, w: 4, h: 6 },
    { i: 'widget-indicative-pulse', x: 4, y: 9, w: 4, h: 6 },
    { i: 'widget-turnout-monitor', x: 8, y: 9, w: 4, h: 6 },
    { i: 'widget-recent-results', x: 0, y: 15, w: 6, h: 7 },
    { i: 'widget-election-leaderboard', x: 6, y: 15, w: 6, h: 7 },
  ];
  const resizeStopLayout = [
    { i: 'widget-live-decisions', x: 0, y: 0, w: 7, h: 10 },
    { i: 'widget-my-vote-queue', x: 7, y: 0, w: 5, h: 9 },
    { i: 'widget-closing-soon', x: 0, y: 10, w: 4, h: 6 },
    { i: 'widget-indicative-pulse', x: 4, y: 10, w: 4, h: 6 },
    { i: 'widget-turnout-monitor', x: 8, y: 10, w: 4, h: 6 },
    { i: 'widget-recent-results', x: 0, y: 16, w: 6, h: 7 },
    { i: 'widget-election-leaderboard', x: 6, y: 16, w: 6, h: 7 },
  ];

  const Responsive = ({
    children,
    isDraggable,
    isResizable,
    draggableHandle,
    draggableCancel,
    resizeHandles,
    resizeHandle,
    onDragStop,
    onResizeStop,
  }: {
    children: ReactNode;
    isDraggable?: boolean;
    isResizable?: boolean;
    draggableHandle?: string;
    draggableCancel?: string;
    resizeHandles?: string[];
    resizeHandle?: (axis: string, ref: Ref<HTMLElement>) => ReactNode;
    onDragStop?: (layout: unknown[]) => void;
    onResizeStop?: (layout: unknown[]) => void;
  }) => (
    <div
      data-testid="decision-grid"
      data-drag-enabled={String(Boolean(isDraggable))}
      data-resize-enabled={String(Boolean(isResizable))}
      data-drag-handle={draggableHandle}
      data-drag-cancel={draggableCancel}
      data-resize-handles={(resizeHandles ?? []).join(',')}
    >
      {resizeHandles?.map(axis => (
        <div key={axis} data-testid={`mock-resize-handle-${axis}`}>
          {resizeHandle?.(axis, { current: null })}
        </div>
      ))}
      <Button type="button" onClick={() => onDragStop?.(dragStopLayout)}>
        simulate drag stop
      </Button>
      <Button type="button" onClick={() => onResizeStop?.(resizeStopLayout)}>
        simulate resize stop
      </Button>
      {children}
    </div>
  );

  const WidthProvider = (Component: ComponentType<Record<string, unknown>>) => {
    return function WidthProvidedGrid(props: Record<string, unknown>) {
      return <Component width={1200} {...props} />;
    };
  };

  return { Responsive, WidthProvider };
});

function decision(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    id: 'V-1',
    sourceId: 'vote-1',
    type: 'vote',
    title: 'Indicative budget vote',
    body: 'City Assembly',
    endsAt: new Date('2026-06-13T18:00:00Z'),
    status: 'open',
    isClosed: false,
    isClosingSoon: true,
    isOpeningSoon: false,
    isRecentlyClosed: false,
    isUrgent: true,
    visibility: 'public',
    trend: { direction: 'up', percentage: 5 },
    href: '/event/event-1/agenda/agenda-1',
    summary: 'Move reserve funds into field operations before the evening session.',
    entity: {
      id: 'amendment-1',
      name: 'Budget Amendment',
      type: 'amendment',
      href: '/amendment/amendment-1',
    },
    agendaItem: {
      id: 'agenda-1',
      name: 'Budget vote agenda item',
      href: '/event/event-1/agenda/agenda-1',
    },
    eventId: 'event-1',
    agendaItemId: 'agenda-1',
    voteId: 'vote-1',
    phase: 'indication',
    ballotVisibility: 'secret',
    voterId: 'voter-1',
    canOpenVoteDialog: true,
    votes: { support: 0, oppose: 0, abstain: 0 },
    indicationVotes: { support: 3, oppose: 1, abstain: 0 },
    votedCount: 4,
    totalMembers: 8,
    turnout: 50,
    isIndicationPhase: true,
    choices: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
      { id: 'abstain', label: 'Abstain' },
    ],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DecisionTerminal dashboard', () => {
  it('renders every default terminal widget when no dashboard preference exists', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    expect(screen.getAllByTestId('decision-widget-drag-handle')).toHaveLength(
      createDefaultDecisionTerminalDashboardConfig().widgets.length
    );
  });

  it('enables basic drag and southeast resize without edit mode', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    const grid = screen.getByTestId('decision-grid');
    expect(grid.getAttribute('data-drag-enabled')).toBe('true');
    expect(grid.getAttribute('data-resize-enabled')).toBe('true');
    expect(grid.getAttribute('data-drag-handle')).toBe('.decision-widget-drag-handle');
    expect(grid.getAttribute('data-resize-handles')).toBe('se');
    expect(grid.getAttribute('data-drag-cancel')).toContain('.decision-widget-content');
    expect(grid.getAttribute('data-drag-cancel')).toContain('.decision-widget-content button');
    expect(grid.getAttribute('data-drag-cancel')).toContain('.decision-widget-content a');
    expect(screen.getByTestId('mock-resize-handle-se')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit widget/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete widget/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Widget$/i })).toBeNull();
  });

  it('persists layout changes on drag and resize stop', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    expect(saveDecisionTerminalDashboard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('simulate drag stop'));

    expect(saveDecisionTerminalDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        version: DECISION_TERMINAL_DASHBOARD_VERSION,
        layouts: expect.objectContaining({
          lg: expect.arrayContaining([
            expect.objectContaining({ i: 'widget-live-decisions', x: 1, y: 0 }),
          ]),
        }),
      })
    );

    saveDecisionTerminalDashboard.mockClear();
    fireEvent.click(screen.getByText('simulate resize stop'));

    expect(saveDecisionTerminalDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layouts: expect.objectContaining({
          lg: expect.arrayContaining([
            expect.objectContaining({ i: 'widget-live-decisions', w: 7, h: 10 }),
          ]),
        }),
      })
    );
  });

  it('resets back to the full basic default layout', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    fireEvent.click(screen.getByTestId('decision-terminal-reset-layout'));

    expect(saveDecisionTerminalDashboard).toHaveBeenCalledWith(
      createDefaultDecisionTerminalDashboardConfig()
    );
  });

  it('renders real links inside widgets without opening a side panel', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    const titleLink = screen.getAllByRole('link', { name: 'Indicative budget vote' })[0];
    expect(titleLink.getAttribute('href')).toBe('/event/event-1/agenda/agenda-1');
    expect(screen.getAllByRole('link', { name: 'Budget Amendment' })[0].getAttribute('href')).toBe(
      '/amendment/amendment-1'
    );
    expect(
      screen.getAllByRole('link', { name: 'Budget vote agenda item' })[0].getAttribute('href')
    ).toBe('/event/event-1/agenda/agenda-1');

    expect(fireEvent.contextMenu(titleLink)).toBe(true);
    const row = screen.getAllByTestId('vote-row')[0];
    expect(row.getAttribute('tabindex')).toBeNull();
    fireEvent.click(row);

    expect(screen.queryByTestId('decision-panel')).toBeNull();
  });

  it('keeps vote, turnout, summary, closed result, and election data visible in widgets', () => {
    const closed = decision({
      id: 'V-2',
      sourceId: 'vote-2',
      title: 'Closed charter vote',
      isClosed: true,
      isRecentlyClosed: true,
      isUrgent: false,
      status: 'passed',
      endsAt: new Date('2026-06-13T17:00:00Z'),
      votes: { support: 5, oppose: 2, abstain: 1 },
      indicationVotes: { support: 4, oppose: 3, abstain: 1 },
      votedCount: 8,
      totalMembers: 10,
      turnout: 80,
    });
    const election = decision({
      id: 'E-1',
      sourceId: 'election-1',
      type: 'election',
      title: 'Session chair election',
      body: 'Demo Session Chair',
      href: '/event/event-1/agenda/agenda-election',
      entity: undefined,
      agendaItem: {
        id: 'agenda-election',
        name: 'Chair election agenda item',
        href: '/event/event-1/agenda/agenda-election',
      },
      voteId: undefined,
      voterId: undefined,
      electionId: 'election-1',
      electorId: 'elector-1',
      votes: undefined,
      indicationVotes: undefined,
      votedCount: 3,
      totalMembers: 5,
      turnout: 60,
      candidates: [
        { id: 'candidate-1', name: 'Mina Bauer', indicationVotes: 2, votes: 0 },
        { id: 'candidate-2', name: 'Omar Stein', indicationVotes: 1, votes: 0 },
      ],
    });

    render(<DecisionTerminal decisions={[decision(), closed, election]} />);

    expect(
      screen.getAllByText('Move reserve funds into field operations before the evening session.')
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('4/8 · 50% · 3/1/0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Closed charter vote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Session chair election').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mina Bauer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3/5 · 60%').length).toBeGreaterThan(0);
  });

  it('uses a real Vote button and opens the vote dialog instead of dragging content', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    expect(screen.queryByText('timeline.terminal.voteSupport')).toBeNull();
    expect(screen.queryByText('timeline.terminal.voteOppose')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: /^Vote$/ })[0]);

    expect(screen.getByTestId('vote-dialog').textContent).toContain('Indicative budget vote');
  });
});
