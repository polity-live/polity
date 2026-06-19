import { describe, expect, it } from 'vitest';
import { decisionTerminalDashboardConfigSchema } from '@/zero/preferences';
import type { DecisionTerminalWidgetType } from '@/zero/preferences';
import type { DecisionItem } from '../../ui/types';
import {
  DECISION_TERMINAL_DASHBOARD_VERSION,
  DECISION_TERMINAL_GRID_COLUMNS,
  createDefaultDecisionTerminalDashboardConfig,
  normalizeDecisionTerminalDashboardConfig,
  selectWidgetDecisions,
} from '../dashboard-config';

const DEFAULT_WIDGET_IDS = [
  'widget-global-decision-timeline',
  'widget-active-votes',
  'widget-active-elections',
  'widget-future-elections',
  'widget-future-votes',
  'widget-past-elections',
  'widget-past-votes',
] as const;

function decision(overrides: Partial<DecisionItem>): DecisionItem {
  return {
    id: 'V-1',
    sourceId: 'vote-1',
    type: 'vote',
    title: 'Budget vote',
    body: 'Finance',
    endsAt: new Date('2026-06-13T18:00:00Z'),
    sortEndsAt: new Date('2026-06-13T18:00:00Z'),
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
    temporalBucket: 'active',
    isActiveDecision: true,
    isFutureDecision: false,
    eventRoleFilterApplies: false,
    hasConfirmedEventRole: false,
    ...overrides,
  };
}

function widget(type: DecisionTerminalWidgetType) {
  const found = createDefaultDecisionTerminalDashboardConfig().widgets.find(
    item => item.type === type
  );

  if (!found) {
    throw new Error(`Missing widget ${type}`);
  }

  return found;
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
  it('creates a schema-valid version 7 dashboard with the seven default panels', () => {
    const config = createDefaultDecisionTerminalDashboardConfig();

    expect(config.version).toBe(7);
    expect(config.version).toBe(DECISION_TERMINAL_DASHBOARD_VERSION);
    expect(config.widgets.map(item => item.id)).toEqual(DEFAULT_WIDGET_IDS);
    expect(config.widgets.map(item => item.type)).toEqual([
      'global_decision_timeline',
      'active_votes',
      'active_elections',
      'future_elections',
      'future_votes',
      'past_elections',
      'past_votes',
    ]);
    expect(config.layouts.lg).toHaveLength(7);
    expect(decisionTerminalDashboardConfigSchema.safeParse(config).success).toBe(true);
  });

  it('creates collision-free responsive layouts with every panel at every breakpoint', () => {
    const { layouts, widgets } = createDefaultDecisionTerminalDashboardConfig();
    const widgetIds = new Set(widgets.map(item => item.id));

    for (const [breakpoint, layout] of Object.entries(layouts)) {
      const cols =
        DECISION_TERMINAL_GRID_COLUMNS[breakpoint as keyof typeof DECISION_TERMINAL_GRID_COLUMNS];
      expectNoLayoutCollisions(layout);
      expect(layout.map(item => item.i).sort()).toEqual([...widgetIds].sort());

      for (const item of layout) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x + item.w).toBeLessThanOrEqual(cols);
        expect(item.minW ?? 0).toBeGreaterThanOrEqual(1);
        expect(item.minH ?? 0).toBeGreaterThanOrEqual(4);
        expect(item.maxW).toBeUndefined();
        expect(item.maxH).toBeUndefined();
      }
    }
  });

  it('starts lg, md, and sm with a full-width global timeline and paired panels below', () => {
    const { layouts } = createDefaultDecisionTerminalDashboardConfig();

    expect(layouts.lg.slice(0, 3)).toEqual([
      expect.objectContaining({ i: 'widget-global-decision-timeline', x: 0, y: 0, w: 12 }),
      expect.objectContaining({ i: 'widget-active-votes', x: 0, y: 9, w: 6 }),
      expect.objectContaining({ i: 'widget-active-elections', x: 6, y: 9, w: 6 }),
    ]);
    expect(layouts.md.slice(0, 3)).toEqual([
      expect.objectContaining({ i: 'widget-global-decision-timeline', x: 0, y: 0, w: 10 }),
      expect.objectContaining({ i: 'widget-active-votes', x: 0, y: 9, w: 5 }),
      expect.objectContaining({ i: 'widget-active-elections', x: 5, y: 9, w: 5 }),
    ]);
    expect(layouts.sm.slice(0, 3)).toEqual([
      expect.objectContaining({ i: 'widget-global-decision-timeline', x: 0, y: 0, w: 6 }),
      expect.objectContaining({ i: 'widget-active-votes', x: 0, y: 8, w: 3 }),
      expect.objectContaining({ i: 'widget-active-elections', x: 3, y: 8, w: 3 }),
    ]);
  });

  it('stacks xs and xxs as full-width mobile RGL panels', () => {
    const { layouts } = createDefaultDecisionTerminalDashboardConfig();

    expect(layouts.xs.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-global-decision-timeline', x: 0, y: 0, w: 4 }),
      expect.objectContaining({ i: 'widget-active-votes', x: 0, y: 8, w: 4 }),
    ]);
    expect(layouts.xxs.slice(0, 2)).toEqual([
      expect.objectContaining({ i: 'widget-global-decision-timeline', x: 0, y: 0, w: 2 }),
      expect.objectContaining({ i: 'widget-active-votes', x: 0, y: 8, w: 2 }),
    ]);
    expect(
      layouts.xxs.every(item => item.x === 0 && item.w === DECISION_TERMINAL_GRID_COLUMNS.xxs)
    ).toBe(true);
  });

  it('falls back to the default dashboard for missing or stale persisted configs', () => {
    expect(normalizeDecisionTerminalDashboardConfig(null).widgets).toHaveLength(7);
    expect(
      normalizeDecisionTerminalDashboardConfig({
        version: 6,
        widgets: [],
        layouts: {},
      }).widgets.map(item => item.id)
    ).toEqual(DEFAULT_WIDGET_IDS);
  });

  it('normalizes version 7 configs back to the supported default panels', () => {
    const config = createDefaultDecisionTerminalDashboardConfig();
    const customLg = config.layouts.lg.map(item =>
      item.i === 'widget-global-decision-timeline' ? { ...item, x: 0, w: 11, h: 10 } : item
    );
    const normalized = normalizeDecisionTerminalDashboardConfig({
      ...config,
      widgets: [
        ...config.widgets,
        {
          id: 'widget-extra',
          type: 'past_votes',
          title: 'Extra past votes',
          displayMode: 'list',
        },
      ],
      layouts: {
        ...config.layouts,
        lg: [{ i: 'widget-extra', x: 0, y: 0, w: 12, h: 4 }, ...customLg],
      },
    });

    expect(normalized.widgets.map(item => item.id)).toEqual(DEFAULT_WIDGET_IDS);
    expect(normalized.layouts.lg).toHaveLength(7);
    expect(normalized.layouts.lg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ i: 'widget-global-decision-timeline', w: 11, h: 10 }),
        expect.objectContaining({ i: 'widget-past-votes' }),
      ])
    );
  });

  it('selects and sorts active, future, past, and global panels by their timeline semantics', () => {
    const activeSoon = decision({
      id: 'V-active-soon',
      sortEndsAt: new Date('2026-06-19T12:00:00Z'),
    });
    const activeLater = decision({
      id: 'V-active-later',
      sortEndsAt: new Date('2026-06-19T18:00:00Z'),
    });
    const futureNear = decision({
      id: 'E-future-near',
      type: 'election',
      temporalBucket: 'future',
      isActiveDecision: false,
      isFutureDecision: true,
      sortStartsAt: new Date('2026-06-20T10:00:00Z'),
    });
    const futureFar = decision({
      id: 'E-future-far',
      type: 'election',
      temporalBucket: 'future',
      isActiveDecision: false,
      isFutureDecision: true,
      sortStartsAt: new Date('2026-06-25T10:00:00Z'),
    });
    const pastRecent = decision({
      id: 'V-past-recent',
      temporalBucket: 'past',
      isClosed: true,
      isActiveDecision: false,
      sortEndsAt: new Date('2026-06-18T20:00:00Z'),
    });
    const pastOld = decision({
      id: 'V-past-old',
      temporalBucket: 'past',
      isClosed: true,
      isActiveDecision: false,
      sortEndsAt: new Date('2026-06-01T20:00:00Z'),
    });
    const decisions = [pastOld, futureNear, activeLater, pastRecent, futureFar, activeSoon];

    expect(selectWidgetDecisions(decisions, widget('active_votes')).map(item => item.id)).toEqual([
      'V-active-soon',
      'V-active-later',
    ]);
    expect(
      selectWidgetDecisions(decisions, widget('future_elections')).map(item => item.id)
    ).toEqual(['E-future-near', 'E-future-far']);
    expect(selectWidgetDecisions(decisions, widget('past_votes')).map(item => item.id)).toEqual([
      'V-past-recent',
      'V-past-old',
    ]);
    expect(
      selectWidgetDecisions(decisions, widget('global_decision_timeline')).map(item => item.id)
    ).toEqual([
      'E-future-far',
      'E-future-near',
      'V-active-soon',
      'V-active-later',
      'V-past-recent',
      'V-past-old',
    ]);
  });

  it('keeps non-event decisions and confirmed event-role decisions when the role filter is enabled', () => {
    const nonEvent = decision({
      id: 'V-non-event',
      sortEndsAt: new Date('2026-06-19T12:00:00Z'),
      eventRoleFilterApplies: false,
      hasConfirmedEventRole: false,
    });
    const confirmedRole = decision({
      id: 'V-confirmed-role',
      sortEndsAt: new Date('2026-06-19T13:00:00Z'),
      eventRoleFilterApplies: true,
      hasConfirmedEventRole: true,
    });
    const invitedOnly = decision({
      id: 'V-invited-only',
      sortEndsAt: new Date('2026-06-19T14:00:00Z'),
      eventRoleFilterApplies: true,
      hasConfirmedEventRole: false,
    });

    expect(
      selectWidgetDecisions([invitedOnly, confirmedRole, nonEvent], widget('active_votes'), '', {
        onlyConfirmedEventRole: true,
      }).map(item => item.id)
    ).toEqual(['V-non-event', 'V-confirmed-role']);
  });
});
