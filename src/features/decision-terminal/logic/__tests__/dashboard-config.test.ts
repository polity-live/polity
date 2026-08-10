import { describe, expect, it } from 'vitest';
import { decisionTerminalDashboardConfigSchema } from '@/zero/preferences';
import type { DecisionTerminalWidgetType } from '@/zero/preferences';
import type { DecisionItem } from '../../ui/types';
import {
  DECISION_TERMINAL_DASHBOARD_VERSION,
  DECISION_TERMINAL_GRID_COLUMNS,
  DECISION_WIDGET_SIZE_PRESETS,
  applyWidgetSizePreset,
  createDecisionWidgetConfig,
  createDefaultDecisionTerminalDashboardConfig,
  getDecisionTerminalColumnsForBreakpoint,
  getWidgetSizePreset,
  normalizeDecisionTerminalDashboardConfig,
  selectWidgetDecisions,
} from '../dashboard-config';

const DEFAULT_WIDGET_IDS = [
  'widget-global-decision-timeline',
  'widget-active-votes',
  'widget-active-elections',
  'widget-future-votes',
  'widget-future-elections',
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
      'future_votes',
      'future_elections',
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

  it('resolves known grid widths and falls back to the desktop width', () => {
    for (const [breakpoint, columns] of Object.entries(DECISION_TERMINAL_GRID_COLUMNS)) {
      expect(getDecisionTerminalColumnsForBreakpoint(breakpoint)).toBe(columns);
    }
    expect(getDecisionTerminalColumnsForBreakpoint('unknown')).toBe(
      DECISION_TERMINAL_GRID_COLUMNS.lg
    );
  });

  it('creates widgets with explicit and generated ids', () => {
    expect(createDecisionWidgetConfig('active_votes', 'custom-widget')).toEqual(
      expect.objectContaining({ id: 'custom-widget', type: 'active_votes' })
    );
    expect(createDecisionWidgetConfig('past_votes').id).toMatch(/^widget-past_votes-/);
  });

  it('detects every exact and inferred widget size preset', () => {
    const defaults = createDefaultDecisionTerminalDashboardConfig();
    const widgetId = defaults.layouts.lg[0].i;
    const withSize = (w: number, h: number) => ({
      ...defaults.layouts,
      lg: defaults.layouts.lg.map(item => (item.i === widgetId ? { ...item, w, h } : item)),
    });

    for (const [preset, size] of Object.entries(DECISION_WIDGET_SIZE_PRESETS)) {
      expect(getWidgetSizePreset(withSize(size.w, size.h), widgetId)).toBe(preset);
    }
    expect(getWidgetSizePreset({ ...defaults.layouts, lg: [] }, widgetId)).toBe('2x1');
    expect(getWidgetSizePreset(withSize(12, 5), widgetId)).toBe('full');
    expect(getWidgetSizePreset(withSize(9, 7), widgetId)).toBe('3x2');
    expect(getWidgetSizePreset(withSize(7, 7), widgetId)).toBe('2x2');
    expect(getWidgetSizePreset(withSize(7, 5), widgetId)).toBe('2x1');
    expect(getWidgetSizePreset(withSize(4, 5), widgetId)).toBe('1x1');
  });

  it('applies presets, clamps them to columns, and resolves collisions deterministically', () => {
    const layouts = {
      lg: [
        { i: 'priority', x: 10, y: 0, w: 2, h: 2, minW: 8 },
        { i: 'overlap', x: 8, y: 0, w: 4, h: 2 },
        { i: 'same-id', x: 0, y: 0, w: 2, h: 2 },
        { i: 'same-id', x: 0, y: 0, w: 2, h: 2 },
        { i: 'left', x: 0, y: 20, w: 2, h: 2 },
        { i: 'right', x: 10, y: 20, w: 2, h: 2 },
        { i: 'above', x: 4, y: 10, w: 2, h: 2 },
        { i: 'below', x: 4, y: 30, w: 2, h: 2 },
      ],
      xxs: [{ i: 'priority', x: 1, y: 0, w: 1, h: 1 }],
    };

    const resized = applyWidgetSizePreset(layouts, 'priority', 'full');
    expect(resized.lg.find(item => item.i === 'priority')).toEqual(
      expect.objectContaining({ x: 0, w: 12, h: 6, minW: 8 })
    );
    expect(resized.lg.find(item => item.i === 'overlap')?.y).toBeGreaterThanOrEqual(6);
    expect(resized.xxs).toEqual(layouts.xxs);
    expect(resized.xxs).not.toBe(layouts.xxs);

    const mobile = applyWidgetSizePreset(layouts, 'priority', '2x1', ['xxs']);
    expect(mobile.xxs[0]).toEqual(expect.objectContaining({ x: 0, w: 2, h: 4, minW: 1 }));

    const missing = applyWidgetSizePreset(layouts, 'missing', '1x1', ['lg']);
    expect(missing).toEqual(layouts);
    expect(missing.lg).not.toBe(layouts.lg);

    const separated = applyWidgetSizePreset(
      {
        lg: [
          { i: 'priority', x: 0, y: 10, w: 4, h: 4 },
          { i: 'strictly-above', x: 0, y: 0, w: 4, h: 2 },
        ],
      },
      'priority',
      '1x1',
      ['lg']
    );
    expect(separated.lg.find(item => item.i === 'strictly-above')?.y).toBe(0);
  });

  it('normalizes every layout field and restores incomplete breakpoints', () => {
    const config = createDefaultDecisionTerminalDashboardConfig();
    const malformedLg = config.layouts.lg.map((item, index) => ({
      ...item,
      x: index === 0 ? 99.8 : item.x,
      y: index === 0 ? -3.2 : item.y,
      w: index === 0 ? 20.2 : item.w,
      h: index === 0 ? 1.2 : item.h,
      minW: index === 0 ? 50.9 : undefined,
      minH: index === 0 ? 0.2 : undefined,
      maxW: 99,
      maxH: 99,
    }));
    const normalized = normalizeDecisionTerminalDashboardConfig({
      ...config,
      layouts: {
        lg: malformedLg,
        md: [],
        sm: config.layouts.sm.slice(0, 1),
        xs: config.layouts.xs,
        xxs: config.layouts.xxs,
      },
    });

    expect(normalized.layouts.lg[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, w: 12, h: 3, minW: 12, minH: 1 })
    );
    expect(normalized.layouts.lg[0].maxW).toBeUndefined();
    expect(normalized.layouts.lg[0].maxH).toBeUndefined();
    expect(normalized.layouts.lg[1].minW).toBeUndefined();
    expect(normalized.layouts.lg[1].minH).toBeUndefined();
    expect(normalized.layouts.md).toEqual(config.layouts.md);
    expect(normalized.layouts.sm).toEqual(config.layouts.sm);
  });

  it('covers status, visibility, role, search, limit, and panel filters', () => {
    const candidates = [
      decision({ id: 'live', title: 'Alpha', body: 'Body alpha', turnout: 10 }),
      decision({ id: 'opening', isOpeningSoon: true, temporalBucket: 'future', turnout: 20 }),
      decision({ id: 'closing', isClosingSoon: true, isUrgent: false, turnout: 30 }),
      decision({
        id: 'recently-closed',
        isClosed: true,
        isRecentlyClosed: true,
        temporalBucket: 'past',
        visibility: 'private',
        turnout: undefined,
      }),
      decision({ id: 'closed', isClosed: true, temporalBucket: 'past', turnout: 40 }),
      decision({
        id: 'election',
        type: 'election',
        temporalBucket: 'active',
        isIndicationPhase: false,
        canOpenVoteDialog: false,
        isUrgent: true,
        turnout: 50,
      }),
    ];
    const base = widget('global_decision_timeline');
    const ids = (filters: typeof base.filters, visibility = base.visibility, query = '') =>
      selectWidgetDecisions(candidates, { ...base, filters, visibility }, query).map(
        item => item.id
      );

    expect(ids(undefined)).toHaveLength(6);
    expect(ids({ status: ['all'] })).toHaveLength(6);
    expect(ids({ status: ['live'] })).toEqual(
      expect.arrayContaining(['live', 'closing', 'election'])
    );
    expect(ids({ status: ['opening_soon'] })).toEqual(['opening']);
    expect(ids({ status: ['closing_soon'] })).toEqual(['closing']);
    expect(ids({ status: ['recently_closed'] })).toEqual(['recently-closed']);
    expect(ids({ status: ['closed'] })).toEqual(
      expect.arrayContaining(['recently-closed', 'closed'])
    );
    expect(ids({ status: ['not-a-status' as never] })).toHaveLength(6);
    expect(ids({ types: ['election'] })).toEqual(['election']);
    expect(ids({ onlyVotable: true })).not.toContain('election');
    expect(ids({ onlyUrgent: true })).toEqual(expect.arrayContaining(['closing', 'election']));
    expect(ids({ onlyIndicative: true })).not.toContain('election');
    expect(ids({ minTurnout: 35 })).toEqual(expect.arrayContaining(['closed', 'election']));
    expect(ids(undefined, 'private')).toEqual(['recently-closed']);
    expect(ids(undefined, 'all')).toHaveLength(6);
    expect(ids(undefined, 'public', 'alpha')).toEqual(['live']);
    expect(ids(undefined, 'public', 'body alpha')).toEqual(['live']);
    expect(ids(undefined, 'public', 'CLOSING')).toEqual(['closing']);
    expect(ids(undefined, 'public', 'missing')).toEqual([]);
    expect(selectWidgetDecisions(candidates, { ...base, limit: 2 })).toHaveLength(2);

    expect(
      selectWidgetDecisions(
        [decision({ eventRoleFilterApplies: true, hasConfirmedEventRole: false })],
        base,
        '',
        { onlyConfirmedEventRole: false }
      )
    ).toHaveLength(1);
  });

  it('sorts through every supported strategy and handles missing or invalid dates', () => {
    const first = decision({
      id: 'first',
      endsAt: null,
      sortEndsAt: undefined,
      startsAt: 'invalid',
      sortStartsAt: undefined,
      turnout: undefined,
      trend: undefined,
      isUrgent: false,
    } as unknown as Partial<DecisionItem>);
    const second = decision({
      id: 'second',
      endsAt: '2026-01-02T00:00:00Z',
      sortEndsAt: '2026-01-02T00:00:00Z',
      startsAt: 1,
      sortStartsAt: new Date('2026-01-01T00:00:00Z'),
      turnout: 25,
      trend: { direction: 'up', percentage: -40 },
      isUrgent: true,
    } as unknown as Partial<DecisionItem>);
    const bothMissing = decision({
      id: 'both-missing',
      endsAt: '2026-01-03T00:00:00Z',
      sortEndsAt: null,
      startsAt: null,
      sortStartsAt: null,
      turnout: undefined,
      trend: undefined,
      isUrgent: false,
    } as unknown as Partial<DecisionItem>);
    const base = widget('global_decision_timeline');

    for (const sort of [
      'active_closing',
      'future_start',
      'past_end',
      'recent',
      'turnout',
      'trend',
      'urgency',
      'closing_soon',
      undefined,
    ] as const) {
      expect(selectWidgetDecisions([second, first], { ...base, sort })).toHaveLength(2);
    }
    expect(
      selectWidgetDecisions([first, bothMissing], { ...base, sort: 'future_start' })
    ).toHaveLength(2);
    expect(selectWidgetDecisions([first, bothMissing], { ...base, sort: 'turnout' })).toHaveLength(
      2
    );
    expect(selectWidgetDecisions([first, bothMissing], { ...base, sort: 'trend' })).toHaveLength(2);
    expect(selectWidgetDecisions([first, bothMissing], { ...base, sort: 'urgency' })).toHaveLength(
      2
    );
  });

  it('derives temporal buckets and routes every panel type', () => {
    const implicit = [
      decision({ id: 'past-vote', temporalBucket: undefined, isClosed: true }),
      decision({
        id: 'future-election',
        type: 'election',
        temporalBucket: undefined,
        isFutureDecision: true,
      }),
      decision({ id: 'final-active', temporalBucket: undefined, phase: 'final' }),
      decision({
        id: 'opening-vote',
        temporalBucket: undefined,
        phase: undefined,
        isOpeningSoon: true,
      }),
      decision({ id: 'default-active', temporalBucket: undefined, phase: undefined }),
    ];

    expect(selectWidgetDecisions(implicit, widget('past_votes')).map(item => item.id)).toEqual([
      'past-vote',
    ]);
    expect(
      selectWidgetDecisions(implicit, widget('future_elections')).map(item => item.id)
    ).toEqual(['future-election']);
    expect(selectWidgetDecisions(implicit, widget('active_votes')).map(item => item.id)).toEqual(
      expect.arrayContaining(['final-active', 'default-active'])
    );
    expect(selectWidgetDecisions(implicit, widget('future_votes')).map(item => item.id)).toEqual([
      'opening-vote',
    ]);
    expect(selectWidgetDecisions(implicit, widget('active_elections'))).toEqual([]);
    expect(selectWidgetDecisions(implicit, widget('past_elections'))).toEqual([]);
  });
});
