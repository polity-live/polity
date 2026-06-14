import { describe, expect, it } from 'vitest';
import { decisionTerminalDashboardConfigSchema } from '@/zero/preferences';
import type { DecisionItem } from '../../ui/types';
import {
  DECISION_TERMINAL_DASHBOARD_VERSION,
  DECISION_TERMINAL_GRID_COLUMNS,
  createDefaultDecisionTerminalDashboardConfig,
  normalizeDecisionTerminalDashboardConfig,
  selectWidgetDecisions,
} from '../dashboard-config';

function decision(overrides: Partial<DecisionItem>): DecisionItem {
  return {
    id: 'V-1',
    sourceId: 'vote-1',
    type: 'vote',
    title: 'Budget vote',
    body: 'Finance',
    endsAt: new Date('2026-06-13T18:00:00Z'),
    status: 'open',
    isClosed: false,
    isClosingSoon: false,
    isOpeningSoon: false,
    isRecentlyClosed: false,
    isUrgent: false,
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    href: '/event/event-1/agenda/agenda-1',
    canOpenVoteDialog: true,
    phase: 'indication',
    isIndicationPhase: true,
    votes: { support: 0, oppose: 0, abstain: 0 },
    indicationVotes: { support: 2, oppose: 1, abstain: 0 },
    ...overrides,
  };
}

function expectNoLayoutCollisions(
  layout: { i: string; x: number; y: number; w: number; h: number }[]
) {
  const occupied = new Map<string, string>();

  for (const item of layout) {
    for (let x = item.x; x < item.x + item.w; x += 1) {
      for (let y = item.y; y < item.y + item.h; y += 1) {
        const key = `${x}:${y}`;
        expect(occupied.get(key), `${item.i} collides at ${key}`).toBeUndefined();
        occupied.set(key, item.i);
      }
    }
  }
}

describe('decision terminal dashboard config', () => {
  it('creates a schema-valid version 6 basic preset with every default widget', () => {
    const config = createDefaultDecisionTerminalDashboardConfig();

    expect(config.version).toBe(6);
    expect(config.version).toBe(DECISION_TERMINAL_DASHBOARD_VERSION);
    expect(config.widgets.map(widget => widget.id)).toEqual([
      'widget-live-decisions',
      'widget-my-vote-queue',
      'widget-closing-soon',
      'widget-indicative-pulse',
      'widget-turnout-monitor',
      'widget-recent-results',
      'widget-election-leaderboard',
    ]);
    expect(config.layouts.lg).toHaveLength(7);
    expect(decisionTerminalDashboardConfigSchema.safeParse(config).success).toBe(true);
  });

  it('creates collision-free responsive layouts with every widget at every breakpoint', () => {
    const { layouts, widgets } = createDefaultDecisionTerminalDashboardConfig();
    const widgetIds = new Set(widgets.map(widget => widget.id));

    for (const [breakpoint, layout] of Object.entries(layouts)) {
      const cols =
        DECISION_TERMINAL_GRID_COLUMNS[breakpoint as keyof typeof DECISION_TERMINAL_GRID_COLUMNS];
      expectNoLayoutCollisions(layout);
      expect(layout.map(item => item.i).sort()).toEqual([...widgetIds].sort());

      for (const item of layout) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x + item.w).toBeLessThanOrEqual(cols);
        expect(item.minW ?? 0).toBeGreaterThanOrEqual(1);
        expect(item.minH ?? 0).toBeGreaterThanOrEqual(3);
        expect(item.maxW).toBeUndefined();
        expect(item.maxH).toBeUndefined();
      }
    }
  });

  it('starts lg, md, and sm with two widgets side by side', () => {
    const { layouts } = createDefaultDecisionTerminalDashboardConfig();

    expect(layouts.lg.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-live-decisions', x: 0, y: 0, w: 6 }),
      expect.objectContaining({ i: 'widget-my-vote-queue', x: 6, y: 0, w: 6 }),
    ]);
    expect(layouts.md.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-live-decisions', x: 0, y: 0, w: 5 }),
      expect.objectContaining({ i: 'widget-my-vote-queue', x: 5, y: 0, w: 5 }),
    ]);
    expect(layouts.sm.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-live-decisions', x: 0, y: 0, w: 3 }),
      expect.objectContaining({ i: 'widget-my-vote-queue', x: 3, y: 0, w: 3 }),
    ]);
  });

  it('starts xs and xxs as full-width mobile RGL widgets', () => {
    const { layouts } = createDefaultDecisionTerminalDashboardConfig();

    expect(layouts.xs.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-live-decisions', x: 0, y: 0, w: 4 }),
      expect.objectContaining({ i: 'widget-my-vote-queue', x: 0, y: 8, w: 4 }),
    ]);
    expect(layouts.xxs.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-live-decisions', x: 0, y: 0, w: 2 }),
      expect.objectContaining({ i: 'widget-my-vote-queue', x: 0, y: 8, w: 2 }),
    ]);
    expect(
      layouts.xxs.every(item => item.x === 0 && item.w === DECISION_TERMINAL_GRID_COLUMNS.xxs)
    ).toBe(true);
  });

  it('falls back to the basic preset for missing or stale persisted configs', () => {
    expect(normalizeDecisionTerminalDashboardConfig(null).widgets).toHaveLength(7);
    expect(
      normalizeDecisionTerminalDashboardConfig({
        version: 5,
        widgets: [],
        layouts: {},
      }).widgets
    ).toHaveLength(7);
  });

  it('normalizes version 6 configs back to the supported default widgets', () => {
    const config = createDefaultDecisionTerminalDashboardConfig();
    const customLg = config.layouts.lg.map(item =>
      item.i === 'widget-live-decisions' ? { ...item, x: 1, w: 5, h: 7 } : item
    );
    const normalized = normalizeDecisionTerminalDashboardConfig({
      ...config,
      widgets: [
        ...config.widgets,
        {
          id: 'widget-extra',
          type: 'recent_results',
          title: 'Recent Results',
          displayMode: 'list',
        },
      ],
      layouts: {
        ...config.layouts,
        lg: [{ i: 'widget-extra', x: 0, y: 0, w: 12, h: 4 }, ...customLg],
      },
    });

    expect(normalized.widgets.map(widget => widget.id)).toEqual([
      'widget-live-decisions',
      'widget-my-vote-queue',
      'widget-closing-soon',
      'widget-indicative-pulse',
      'widget-turnout-monitor',
      'widget-recent-results',
      'widget-election-leaderboard',
    ]);
    expect(normalized.layouts.lg).toHaveLength(7);
    expect(normalized.layouts.lg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i: 'widget-live-decisions', x: 1, w: 5, h: 7 }),
        expect.objectContaining({ i: 'widget-election-leaderboard' }),
      ])
    );
  });

  it('filters live and votable decisions for the two default widgets', () => {
    const config = createDefaultDecisionTerminalDashboardConfig();
    const liveWidget = config.widgets.find(widget => widget.type === 'live_decisions');
    const queueWidget = config.widgets.find(widget => widget.type === 'my_vote_queue');
    const finalDecision = decision({
      id: 'V-2',
      sourceId: 'vote-2',
      phase: 'final_vote',
      isIndicationPhase: false,
      canOpenVoteDialog: true,
    });
    const readOnlyDecision = decision({
      id: 'V-3',
      sourceId: 'vote-3',
      canOpenVoteDialog: false,
    });

    expect(liveWidget).toBeDefined();
    expect(queueWidget).toBeDefined();
    if (!liveWidget || !queueWidget) {
      throw new Error('Expected default decision widgets');
    }

    expect(
      selectWidgetDecisions([decision({}), finalDecision, readOnlyDecision], liveWidget).map(
        item => item.id
      )
    ).toEqual(['V-1', 'V-2', 'V-3']);
    expect(
      selectWidgetDecisions([decision({}), finalDecision, readOnlyDecision], queueWidget).map(
        item => item.id
      )
    ).toEqual(['V-1', 'V-2']);
  });
});
