import { decisionTerminalDashboardConfigSchema } from '@/zero/preferences';
import type {
  DecisionTerminalDashboardConfig,
  DecisionTerminalGridLayoutItem,
  DecisionTerminalWidgetConfig,
  DecisionTerminalWidgetType,
  DecisionTerminalWidgetVisibility,
} from '@/zero/preferences';
import type { DecisionItem } from '../ui/types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const DECISION_TERMINAL_DASHBOARD_VERSION = 7;
export const DECISION_TERMINAL_DESKTOP_COLUMNS = 12;
export const DECISION_TERMINAL_TABLET_COLUMNS = 10;
export const DECISION_TERMINAL_SMALL_COLUMNS = 6;
export const DECISION_TERMINAL_XS_COLUMNS = 4;
export const DECISION_TERMINAL_XXS_COLUMNS = 2;

export const DECISION_TERMINAL_GRID_BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
} as const;

export const DECISION_TERMINAL_GRID_COLUMNS = {
  lg: DECISION_TERMINAL_DESKTOP_COLUMNS,
  md: DECISION_TERMINAL_TABLET_COLUMNS,
  sm: DECISION_TERMINAL_SMALL_COLUMNS,
  xs: DECISION_TERMINAL_XS_COLUMNS,
  xxs: DECISION_TERMINAL_XXS_COLUMNS,
} as const;

export type DecisionTerminalGridBreakpoint = keyof typeof DECISION_TERMINAL_GRID_COLUMNS;

export const DECISION_WIDGET_SIZE_PRESETS = {
  '1x1': {
    label: '1x1',
    description: translateText('generated.inline.0059_compact_tile_b40d85c3'),
    w: 3,
    h: 4,
  },
  '2x1': {
    label: '2x1',
    description: translateText('generated.inline.0060_wide_panel_1398e0f3'),
    w: 6,
    h: 4,
  },
  '2x2': {
    label: '2x2',
    description: translateText('generated.inline.0061_tall_panel_30380b6e'),
    w: 6,
    h: 8,
  },
  '3x2': {
    label: '3x2',
    description: translateText('generated.inline.0062_large_workspace_80cb0305'),
    w: 9,
    h: 8,
  },
  full: {
    label: translateText('generated.inline.0063_full_width_8087e6de'),
    description: translateText('generated.inline.0064_span_the_desktop_row_5c14cd3d'),
    w: DECISION_TERMINAL_DESKTOP_COLUMNS,
    h: 6,
  },
} as const;

export type DecisionWidgetSizePreset = keyof typeof DECISION_WIDGET_SIZE_PRESETS;

export const DECISION_WIDGET_TEMPLATES: Record<
  DecisionTerminalWidgetType,
  Omit<DecisionTerminalWidgetConfig, 'id'>
> = {
  global_decision_timeline: {
    type: 'global_decision_timeline',
    title: translateText(
      'features.decisionTerminal.panels.globalDecisionTimeline',
      'All global votes and elections'
    ),
    displayMode: 'list',
    sort: 'global_timeline',
    visibility: 'all',
  },
  active_votes: {
    type: 'active_votes',
    title: translateText('features.decisionTerminal.panels.activeVotes', 'Active votes'),
    displayMode: 'list',
    sort: 'active_closing',
    filters: { types: ['vote'] },
    visibility: 'all',
  },
  active_elections: {
    type: 'active_elections',
    title: translateText('features.decisionTerminal.panels.activeElections', 'Active elections'),
    displayMode: 'list',
    sort: 'active_closing',
    filters: { types: ['election'] },
    visibility: 'all',
  },
  future_elections: {
    type: 'future_elections',
    title: translateText('features.decisionTerminal.panels.futureElections', 'Future elections'),
    displayMode: 'list',
    sort: 'future_start',
    filters: { types: ['election'] },
    visibility: 'all',
  },
  future_votes: {
    type: 'future_votes',
    title: translateText('features.decisionTerminal.panels.futureVotes', 'Future votes'),
    displayMode: 'list',
    sort: 'future_start',
    filters: { types: ['vote'] },
    visibility: 'all',
  },
  past_elections: {
    type: 'past_elections',
    title: translateText('features.decisionTerminal.panels.pastElections', 'Past elections'),
    displayMode: 'list',
    sort: 'past_end',
    filters: { types: ['election'] },
    visibility: 'all',
  },
  past_votes: {
    type: 'past_votes',
    title: translateText('features.decisionTerminal.panels.pastVotes', 'Past votes'),
    displayMode: 'list',
    sort: 'past_end',
    filters: { types: ['vote'] },
    visibility: 'all',
  },
};

const DEFAULT_WIDGET_IDS: Record<DecisionTerminalWidgetType, string> = {
  global_decision_timeline: 'widget-global-decision-timeline',
  active_votes: 'widget-active-votes',
  active_elections: 'widget-active-elections',
  future_elections: 'widget-future-elections',
  future_votes: 'widget-future-votes',
  past_elections: 'widget-past-elections',
  past_votes: 'widget-past-votes',
};

const DEFAULT_WIDGET_ORDER: DecisionTerminalWidgetType[] = [
  'global_decision_timeline',
  'active_votes',
  'active_elections',
  'future_votes',
  'future_elections',
  'past_elections',
  'past_votes',
];

function makeWidget(type: DecisionTerminalWidgetType): DecisionTerminalWidgetConfig {
  return {
    id: DEFAULT_WIDGET_IDS[type],
    ...DECISION_WIDGET_TEMPLATES[type],
  };
}

function cloneLayout(layout: DecisionTerminalGridLayoutItem[]): DecisionTerminalGridLayoutItem[] {
  return layout.map(item => ({ ...item }));
}

function stripSizeCaps(item: DecisionTerminalGridLayoutItem): DecisionTerminalGridLayoutItem {
  const next = { ...item };
  delete next.maxW;
  delete next.maxH;
  return next;
}

export function createDefaultDecisionTerminalDashboardConfig(): DecisionTerminalDashboardConfig {
  const widgets = DEFAULT_WIDGET_ORDER.map(type => makeWidget(type));

  const lg: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-global-decision-timeline', x: 0, y: 0, w: 12, h: 9, minW: 4, minH: 5 },
    { i: 'widget-active-votes', x: 0, y: 9, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'widget-active-elections', x: 6, y: 9, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'widget-future-votes', x: 0, y: 16, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'widget-future-elections', x: 6, y: 16, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'widget-past-elections', x: 0, y: 23, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'widget-past-votes', x: 6, y: 23, w: 6, h: 7, minW: 3, minH: 4 },
  ];

  const md: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-global-decision-timeline', x: 0, y: 0, w: 10, h: 9, minW: 4, minH: 5 },
    { i: 'widget-active-votes', x: 0, y: 9, w: 5, h: 7, minW: 3, minH: 4 },
    { i: 'widget-active-elections', x: 5, y: 9, w: 5, h: 7, minW: 3, minH: 4 },
    { i: 'widget-future-votes', x: 0, y: 16, w: 5, h: 7, minW: 3, minH: 4 },
    { i: 'widget-future-elections', x: 5, y: 16, w: 5, h: 7, minW: 3, minH: 4 },
    { i: 'widget-past-elections', x: 0, y: 23, w: 5, h: 7, minW: 3, minH: 4 },
    { i: 'widget-past-votes', x: 5, y: 23, w: 5, h: 7, minW: 3, minH: 4 },
  ];

  const sm: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-global-decision-timeline', x: 0, y: 0, w: 6, h: 8, minW: 2, minH: 5 },
    { i: 'widget-active-votes', x: 0, y: 8, w: 3, h: 7, minW: 2, minH: 4 },
    { i: 'widget-active-elections', x: 3, y: 8, w: 3, h: 7, minW: 2, minH: 4 },
    { i: 'widget-future-votes', x: 0, y: 15, w: 3, h: 7, minW: 2, minH: 4 },
    { i: 'widget-future-elections', x: 3, y: 15, w: 3, h: 7, minW: 2, minH: 4 },
    { i: 'widget-past-elections', x: 0, y: 22, w: 3, h: 7, minW: 2, minH: 4 },
    { i: 'widget-past-votes', x: 3, y: 22, w: 3, h: 7, minW: 2, minH: 4 },
  ];

  const xs: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-global-decision-timeline', x: 0, y: 0, w: 4, h: 8, minW: 1, minH: 5 },
    { i: 'widget-active-votes', x: 0, y: 8, w: 4, h: 6, minW: 1, minH: 4 },
    { i: 'widget-active-elections', x: 0, y: 14, w: 4, h: 6, minW: 1, minH: 4 },
    { i: 'widget-future-votes', x: 0, y: 20, w: 4, h: 6, minW: 1, minH: 4 },
    { i: 'widget-future-elections', x: 0, y: 26, w: 4, h: 6, minW: 1, minH: 4 },
    { i: 'widget-past-elections', x: 0, y: 32, w: 4, h: 6, minW: 1, minH: 4 },
    { i: 'widget-past-votes', x: 0, y: 38, w: 4, h: 6, minW: 1, minH: 4 },
  ];

  const xxs: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-global-decision-timeline', x: 0, y: 0, w: 2, h: 8, minW: 1, minH: 5 },
    { i: 'widget-active-votes', x: 0, y: 8, w: 2, h: 6, minW: 1, minH: 4 },
    { i: 'widget-active-elections', x: 0, y: 14, w: 2, h: 6, minW: 1, minH: 4 },
    { i: 'widget-future-votes', x: 0, y: 20, w: 2, h: 6, minW: 1, minH: 4 },
    { i: 'widget-future-elections', x: 0, y: 26, w: 2, h: 6, minW: 1, minH: 4 },
    { i: 'widget-past-elections', x: 0, y: 32, w: 2, h: 6, minW: 1, minH: 4 },
    { i: 'widget-past-votes', x: 0, y: 38, w: 2, h: 6, minW: 1, minH: 4 },
  ];

  return {
    version: DECISION_TERMINAL_DASHBOARD_VERSION,
    widgets,
    layouts: {
      lg,
      md,
      sm,
      xs,
      xxs,
    },
  };
}

export function getDecisionTerminalColumnsForBreakpoint(breakpoint: string) {
  return (
    DECISION_TERMINAL_GRID_COLUMNS[breakpoint as DecisionTerminalGridBreakpoint] ??
    DECISION_TERMINAL_DESKTOP_COLUMNS
  );
}

function layoutItemsCollide(
  left: DecisionTerminalGridLayoutItem,
  right: DecisionTerminalGridLayoutItem
) {
  if (left.i === right.i) return false;
  if (left.x + left.w <= right.x) return false;
  if (right.x + right.w <= left.x) return false;
  if (left.y + left.h <= right.y) return false;
  if (right.y + right.h <= left.y) return false;
  return true;
}

function resolveLayoutCollisions(layout: DecisionTerminalGridLayoutItem[], priorityItemId: string) {
  const priorityItem = layout.find(item => item.i === priorityItemId);
  if (!priorityItem) return cloneLayout(layout);

  const adjusted = new Map<string, DecisionTerminalGridLayoutItem>();
  const placed: DecisionTerminalGridLayoutItem[] = [{ ...priorityItem }];
  adjusted.set(priorityItem.i, placed[0]);

  const remaining = layout
    .filter(item => item.i !== priorityItemId)
    .map(item => ({ ...item }))
    .sort((left, right) => left.y - right.y || left.x - right.x);

  for (const originalItem of remaining) {
    const item = { ...originalItem };
    let collision = placed.find(placedItem => layoutItemsCollide(item, placedItem));
    while (collision) {
      item.y = collision.y + collision.h;
      collision = placed.find(placedItem => layoutItemsCollide(item, placedItem));
    }
    placed.push(item);
    adjusted.set(item.i, item);
  }

  return layout.map(item => adjusted.get(item.i) ?? { ...item });
}

export function applyWidgetSizePreset(
  layouts: DecisionTerminalDashboardConfig['layouts'],
  widgetId: string,
  preset: DecisionWidgetSizePreset,
  breakpoints: string[] = ['lg', 'md']
): DecisionTerminalDashboardConfig['layouts'] {
  const size = DECISION_WIDGET_SIZE_PRESETS[preset];
  const targetBreakpoints = new Set(breakpoints);

  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, layout]) => {
      if (!targetBreakpoints.has(breakpoint)) {
        return [breakpoint, cloneLayout(layout)];
      }

      const cols = getDecisionTerminalColumnsForBreakpoint(breakpoint);
      const width = Math.min(size.w, cols);
      const height = size.h;

      const resizedLayout = layout.map(item => {
        if (item.i !== widgetId) return { ...item };

        return {
          ...item,
          w: width,
          h: height,
          x: Math.min(item.x, Math.max(0, cols - width)),
          minW: Math.min(item.minW ?? 1, width),
        };
      });

      return [breakpoint, resolveLayoutCollisions(resizedLayout, widgetId)];
    })
  );
}

export function getWidgetSizePreset(
  layouts: DecisionTerminalDashboardConfig['layouts'],
  widgetId: string
): DecisionWidgetSizePreset {
  const item = layouts.lg?.find(layoutItem => layoutItem.i === widgetId);
  if (!item) return '2x1';

  const exact = Object.entries(DECISION_WIDGET_SIZE_PRESETS).find(
    ([, size]) => size.w === item.w && size.h === item.h
  );
  if (exact) return exact[0] as DecisionWidgetSizePreset;
  if (item.w >= DECISION_TERMINAL_DESKTOP_COLUMNS) return 'full';
  if (item.w >= 9) return '3x2';
  if (item.w >= 6 && item.h >= 7) return '2x2';
  if (item.w >= 6) return '2x1';
  return '1x1';
}

export function normalizeDecisionTerminalDashboardConfig(
  config: DecisionTerminalDashboardConfig | null | undefined
): DecisionTerminalDashboardConfig {
  const parsed = decisionTerminalDashboardConfigSchema.safeParse(config);
  if (!parsed.success || parsed.data.version !== DECISION_TERMINAL_DASHBOARD_VERSION) {
    return createDefaultDecisionTerminalDashboardConfig();
  }

  const defaults = createDefaultDecisionTerminalDashboardConfig();
  const widgetIds = new Set(defaults.widgets.map(widget => widget.id));
  const layouts = Object.fromEntries(
    Object.entries(defaults.layouts).map(([breakpoint, defaultLayout]) => {
      const existingLayout = parsed.data.layouts[breakpoint];
      if (!existingLayout?.length) return [breakpoint, cloneLayout(defaultLayout)];

      const normalizedLayout = existingLayout
        .filter(item => widgetIds.has(item.i))
        .map(item => {
          const uncappedItem = stripSizeCaps(item);
          const cols = getDecisionTerminalColumnsForBreakpoint(breakpoint);
          const width = Math.min(Math.max(1, Math.round(item.w)), cols);
          const minW =
            typeof item.minW === 'number'
              ? Math.min(Math.max(1, Math.round(item.minW)), width)
              : undefined;
          const minH =
            typeof item.minH === 'number' ? Math.max(1, Math.round(item.minH)) : undefined;

          return {
            ...uncappedItem,
            x: Math.min(Math.max(0, Math.round(item.x)), Math.max(0, cols - width)),
            y: Math.max(0, Math.round(item.y)),
            w: width,
            h: Math.max(3, Math.round(item.h)),
            minW,
            minH,
          };
        });

      return [
        breakpoint,
        normalizedLayout.length === widgetIds.size ? normalizedLayout : cloneLayout(defaultLayout),
      ];
    })
  );

  return {
    version: DECISION_TERMINAL_DASHBOARD_VERSION,
    widgets: defaults.widgets,
    layouts,
  };
}

export function createDecisionWidgetConfig(
  type: DecisionTerminalWidgetType,
  id = `widget-${type}-${crypto.randomUUID()}`
): DecisionTerminalWidgetConfig {
  return {
    id,
    ...DECISION_WIDGET_TEMPLATES[type],
  };
}

function matchesStatus(decision: DecisionItem, statuses?: string[]) {
  if (!statuses?.length || statuses.includes('all')) return true;

  return statuses.some(status => {
    switch (status) {
      case 'live':
        return !decision.isClosed && !decision.isOpeningSoon;
      case 'opening_soon':
        return !decision.isClosed && decision.isOpeningSoon;
      case 'closing_soon':
        return !decision.isClosed && decision.isClosingSoon;
      case 'recently_closed':
        return decision.isClosed && decision.isRecentlyClosed;
      case 'closed':
        return decision.isClosed;
      default:
        return true;
    }
  });
}

function matchesVisibility(decision: DecisionItem, visibility?: DecisionTerminalWidgetVisibility) {
  if (!visibility || visibility === 'all') return true;
  return decision.visibility === visibility;
}

function getTimestamp(value: Date | string | number | null | undefined) {
  if (value == null) return 0;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDecisionEndTimestamp(decision: DecisionItem) {
  return getTimestamp(decision.sortEndsAt ?? decision.endsAt);
}

function getDecisionStartTimestamp(decision: DecisionItem) {
  return getTimestamp(decision.sortStartsAt ?? decision.startsAt ?? decision.endsAt);
}

function getTemporalBucket(decision: DecisionItem): NonNullable<DecisionItem['temporalBucket']> {
  if (decision.temporalBucket) return decision.temporalBucket;

  if (decision.isClosed) return 'past';
  if (decision.isFutureDecision) return 'future';
  if (decision.phase === 'indication' || decision.phase === 'final') return 'active';
  if (decision.isOpeningSoon) return 'future';
  return 'active';
}

function matchesRoleFilter(decision: DecisionItem, onlyConfirmedEventRole?: boolean) {
  if (!onlyConfirmedEventRole) return true;
  if (!decision.eventRoleFilterApplies) return true;
  return Boolean(decision.hasConfirmedEventRole);
}

function compareDecisions(
  left: DecisionItem,
  right: DecisionItem,
  sort: DecisionTerminalWidgetConfig['sort']
) {
  switch (sort) {
    case 'global_timeline':
      return compareGlobalTimeline(left, right);
    case 'active_closing':
      return getDecisionEndTimestamp(left) - getDecisionEndTimestamp(right);
    case 'future_start':
      return getDecisionStartTimestamp(left) - getDecisionStartTimestamp(right);
    case 'past_end':
      return getDecisionEndTimestamp(right) - getDecisionEndTimestamp(left);
    case 'recent':
      return getDecisionEndTimestamp(right) - getDecisionEndTimestamp(left);
    case 'turnout':
      return (right.turnout ?? 0) - (left.turnout ?? 0);
    case 'trend':
      return Math.abs(right.trend?.percentage ?? 0) - Math.abs(left.trend?.percentage ?? 0);
    case 'urgency':
      return (
        Number(right.isUrgent) - Number(left.isUrgent) ||
        getDecisionEndTimestamp(left) - getDecisionEndTimestamp(right)
      );
    case 'closing_soon':
    default:
      return getDecisionEndTimestamp(left) - getDecisionEndTimestamp(right);
  }
}

function compareGlobalTimeline(left: DecisionItem, right: DecisionItem) {
  const bucketOrder: Record<NonNullable<DecisionItem['temporalBucket']>, number> = {
    future: 0,
    active: 1,
    past: 2,
  };
  const leftBucket = getTemporalBucket(left);
  const rightBucket = getTemporalBucket(right);

  if (leftBucket !== rightBucket) {
    return bucketOrder[leftBucket] - bucketOrder[rightBucket];
  }

  if (leftBucket === 'future') {
    return getDecisionStartTimestamp(right) - getDecisionStartTimestamp(left);
  }

  if (leftBucket === 'past') {
    return getDecisionEndTimestamp(right) - getDecisionEndTimestamp(left);
  }

  return getDecisionEndTimestamp(left) - getDecisionEndTimestamp(right);
}

function matchesWidgetPanel(decision: DecisionItem, widget: DecisionTerminalWidgetConfig) {
  const bucket = getTemporalBucket(decision);

  switch (widget.type) {
    case 'active_votes':
      return decision.type === 'vote' && bucket === 'active';
    case 'active_elections':
      return decision.type === 'election' && bucket === 'active';
    case 'future_elections':
      return decision.type === 'election' && bucket === 'future';
    case 'future_votes':
      return decision.type === 'vote' && bucket === 'future';
    case 'past_elections':
      return decision.type === 'election' && bucket === 'past';
    case 'past_votes':
      return decision.type === 'vote' && bucket === 'past';
    case 'global_decision_timeline':
    default:
      return true;
  }
}

export interface SelectWidgetDecisionsOptions {
  onlyConfirmedEventRole?: boolean;
}

export function selectWidgetDecisions(
  decisions: DecisionItem[],
  widget: DecisionTerminalWidgetConfig,
  searchQuery = '',
  options: SelectWidgetDecisionsOptions = {}
) {
  const query = searchQuery.trim().toLowerCase();

  const selected = decisions
    .filter(decision => {
      const filters = widget.filters;
      if (!matchesWidgetPanel(decision, widget)) return false;
      if (!matchesRoleFilter(decision, options.onlyConfirmedEventRole)) return false;
      if (!matchesStatus(decision, filters?.status)) return false;
      if (filters?.types?.length && !filters.types.includes(decision.type)) return false;
      if (filters?.onlyVotable && !decision.canOpenVoteDialog) return false;
      if (filters?.onlyUrgent && !decision.isUrgent && !decision.isClosingSoon) return false;
      if (filters?.onlyIndicative && !decision.isIndicationPhase) return false;
      if (typeof filters?.minTurnout === 'number' && (decision.turnout ?? 0) < filters.minTurnout) {
        return false;
      }
      if (!matchesVisibility(decision, widget.visibility)) return false;
      if (query) {
        return (
          decision.title.toLowerCase().includes(query) ||
          decision.body.toLowerCase().includes(query) ||
          decision.id.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((left, right) => compareDecisions(left, right, widget.sort));

  return typeof widget.limit === 'number' ? selected.slice(0, widget.limit) : selected;
}
