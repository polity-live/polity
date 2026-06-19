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

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
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
    { i: 'widget-global-decision-timeline', x: 1, y: 0, w: 11, h: 9 },
    { i: 'widget-active-votes', x: 0, y: 9, w: 6, h: 7 },
    { i: 'widget-active-elections', x: 6, y: 9, w: 6, h: 7 },
    { i: 'widget-future-votes', x: 0, y: 16, w: 6, h: 7 },
    { i: 'widget-future-elections', x: 6, y: 16, w: 6, h: 7 },
    { i: 'widget-past-elections', x: 0, y: 23, w: 6, h: 7 },
    { i: 'widget-past-votes', x: 6, y: 23, w: 6, h: 7 },
  ];
  const resizeStopLayout = [
    { i: 'widget-global-decision-timeline', x: 0, y: 0, w: 12, h: 10 },
    { i: 'widget-active-votes', x: 0, y: 10, w: 7, h: 8 },
    { i: 'widget-active-elections', x: 7, y: 10, w: 5, h: 7 },
    { i: 'widget-future-votes', x: 0, y: 18, w: 6, h: 7 },
    { i: 'widget-future-elections', x: 6, y: 18, w: 6, h: 7 },
    { i: 'widget-past-elections', x: 0, y: 25, w: 6, h: 7 },
    { i: 'widget-past-votes', x: 6, y: 25, w: 6, h: 7 },
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
            expect.objectContaining({ i: 'widget-global-decision-timeline', x: 1, y: 0 }),
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
            expect.objectContaining({ i: 'widget-global-decision-timeline', w: 12, h: 10 }),
            expect.objectContaining({ i: 'widget-active-votes', w: 7, h: 8 }),
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

    const { container } = render(<DecisionTerminal decisions={[decision(), closed, election]} />);

    expect(
      screen.getAllByText('Move reserve funds into field operations before the evening session.')
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('4/8 · 50% · IND').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Closed charter vote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Session chair election').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mina Bauer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3/5 · 60% · IND').length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('[data-election-candidate-row="true"]').length
    ).toBeGreaterThan(0);
  });

  it('hides delegate election metadata and technical IDs from election cards', () => {
    const electionHref = '/event/event-1/agenda/delegate-election';
    render(
      <DecisionTerminal
        decisions={[
          decision({
            id: 'E-002',
            sourceId: 'election-delegate-1',
            type: 'election',
            title: 'Delegiertenwahl: Delegate assembly',
            body: 'Delegierte:r fuer Delegate assembly - Sitz 1',
            href: electionHref,
            entity: undefined,
            agendaItem: {
              id: 'delegate-election',
              name: 'Delegiertenwahl: Delegate assembly',
              href: electionHref,
            },
            voteId: undefined,
            voterId: undefined,
            electionId: 'election-delegate-1',
            electorId: 'elector-1',
            summary: `@delegate-election-meta ${JSON.stringify({
              kind: 'delegate_election',
              targetEventId: 'target-event',
              targetGroupId: 'target-group',
              sourceGroupId: 'source-group',
              seatRoleIds: ['seat-1'],
              allSeatRoleIds: ['seat-1'],
              mode: 'single',
            })}\nWaehlt die Delegierten von B1 fuer Delegate assembly.`,
            votes: undefined,
            indicationVotes: undefined,
            candidates: [
              { id: 'candidate-1', name: 'Tobias Hassebrock', indicationVotes: 0, votes: 0 },
            ],
          }),
        ]}
      />
    );

    expect(screen.queryByText(/@delegate-election-meta/)).toBeNull();
    expect(screen.queryByText(/targetEventId/)).toBeNull();
    expect(screen.queryByText('E-002')).toBeNull();
    expect(
      screen.getAllByText('Waehlt die Delegierten von B1 fuer Delegate assembly.')
    ).toHaveLength(2);
    expect(screen.getAllByText('Tobias Hassebrock').length).toBeGreaterThan(0);

    const titleLinks = screen.getAllByRole('link', { name: 'Delegiertenwahl: Delegate assembly' });
    expect(titleLinks).toHaveLength(2);
    expect(titleLinks[0].getAttribute('href')).toBe(electionHref);
  });

  it('uses a real Vote button and opens the vote dialog instead of dragging content', () => {
    render(<DecisionTerminal decisions={[decision()]} />);

    expect(screen.queryByText('timeline.terminal.voteSupport')).toBeNull();
    expect(screen.queryByText('timeline.terminal.voteOppose')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: /^Vote$/ })[0]);

    expect(screen.getByTestId('vote-dialog').textContent).toContain('Indicative budget vote');
  });

  it('filters event decisions without confirmed roles when each panel toggle is enabled', () => {
    render(
      <DecisionTerminal
        decisions={[
          decision({
            id: 'V-public',
            title: 'Global policy vote',
            eventRoleFilterApplies: false,
            hasConfirmedEventRole: false,
          }),
          decision({
            id: 'V-role',
            title: 'Confirmed role vote',
            eventRoleFilterApplies: true,
            hasConfirmedEventRole: true,
          }),
          decision({
            id: 'V-invited',
            title: 'Invited only vote',
            eventRoleFilterApplies: true,
            hasConfirmedEventRole: false,
          }),
        ]}
      />
    );

    expect(screen.getAllByText('Invited only vote').length).toBeGreaterThan(0);

    for (const toggle of screen.getAllByRole('button', { name: 'My event roles' })) {
      fireEvent.click(toggle);
    }

    expect(screen.queryByText('Invited only vote')).toBeNull();
    expect(screen.getAllByText('Confirmed role vote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Global policy vote').length).toBeGreaterThan(0);
  });

  it('shows a transient positive delta when a support vote arrives live', async () => {
    const { rerender } = render(<DecisionTerminal decisions={[decision()]} />);

    rerender(
      <DecisionTerminal
        decisions={[
          decision({
            indicationVotes: { support: 4, oppose: 1, abstain: 0 },
            votedCount: 5,
          }),
        ]}
      />
    );

    expect((await screen.findAllByText('+1')).length).toBeGreaterThan(0);
  });
});
