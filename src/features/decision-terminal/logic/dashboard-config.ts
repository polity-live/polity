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

export const DECISION_TERMINAL_DASHBOARD_VERSION = 6;
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
  live_decisions: {
    type: 'live_decisions',
    title: translateText('generated.inline.0065_live_decisions_6409f2ef'),
    displayMode: 'table',
    sort: 'closing_soon',
    limit: 12,
    filters: { status: ['live'] },
    visibility: 'all',
  },
  my_vote_queue: {
    type: 'my_vote_queue',
    title: translateText('generated.inline.0066_my_vote_queue_7a46c525'),
    displayMode: 'list',
    sort: 'urgency',
    limit: 8,
    filters: { status: ['live'], onlyVotable: true },
    visibility: 'all',
  },
  closing_soon: {
    type: 'closing_soon',
    title: translateText('generated.inline.0067_closing_soon_c287b749'),
    displayMode: 'tape',
    sort: 'closing_soon',
    limit: 8,
    filters: { status: ['live'], onlyUrgent: true },
    visibility: 'all',
  },
  indicative_pulse: {
    type: 'indicative_pulse',
    title: translateText('generated.inline.0068_indicative_pulse_b69e59fa'),
    displayMode: 'tape',
    sort: 'trend',
    limit: 8,
    filters: { status: ['live'], onlyIndicative: true },
    visibility: 'all',
  },
  turnout_monitor: {
    type: 'turnout_monitor',
    title: translateText('generated.inline.0069_turnout_monitor_ab0146fb'),
    displayMode: 'metric',
    sort: 'turnout',
    limit: 10,
    filters: { status: ['live'] },
    visibility: 'all',
  },
  recent_results: {
    type: 'recent_results',
    title: translateText('generated.inline.0070_recent_results_fe95b32f'),
    displayMode: 'list',
    sort: 'recent',
    limit: 8,
    filters: { status: ['recently_closed'] },
    visibility: 'all',
  },
  election_leaderboard: {
    type: 'election_leaderboard',
    title: translateText('generated.inline.0071_election_leaderboard_0ed0cb9b'),
    displayMode: 'leaderboard',
    sort: 'turnout',
    limit: 8,
    filters: { status: ['live'], types: ['election'] },
    visibility: 'all',
  },
};

const DEFAULT_WIDGET_IDS: Record<DecisionTerminalWidgetType, string> = {
  live_decisions: 'widget-live-decisions',
  my_vote_queue: 'widget-my-vote-queue',
  closing_soon: 'widget-closing-soon',
  indicative_pulse: 'widget-indicative-pulse',
  turnout_monitor: 'widget-turnout-monitor',
  recent_results: 'widget-recent-results',
  election_leaderboard: 'widget-election-leaderboard',
};

const DEFAULT_WIDGET_ORDER: DecisionTerminalWidgetType[] = [
  'live_decisions',
  'my_vote_queue',
  'closing_soon',
  'indicative_pulse',
  'turnout_monitor',
  'recent_results',
  'election_leaderboard',
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
    { i: 'widget-live-decisions', x: 0, y: 0, w: 6, h: 9, minW: 3, minH: 4 },
    { i: 'widget-my-vote-queue', x: 6, y: 0, w: 6, h: 9, minW: 3, minH: 4 },
    { i: 'widget-closing-soon', x: 0, y: 9, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'widget-indicative-pulse', x: 4, y: 9, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'widget-turnout-monitor', x: 8, y: 9, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'widget-recent-results', x: 0, y: 15, w: 6, h: 7, minW: 3, minH: 3 },
    { i: 'widget-election-leaderboard', x: 6, y: 15, w: 6, h: 7, minW: 3, minH: 3 },
  ];

  const md: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-live-decisions', x: 0, y: 0, w: 5, h: 9, minW: 3, minH: 4 },
    { i: 'widget-my-vote-queue', x: 5, y: 0, w: 5, h: 9, minW: 3, minH: 4 },
    { i: 'widget-closing-soon', x: 0, y: 9, w: 5, h: 6, minW: 3, minH: 3 },
    { i: 'widget-indicative-pulse', x: 5, y: 9, w: 5, h: 6, minW: 3, minH: 3 },
    { i: 'widget-turnout-monitor', x: 0, y: 15, w: 5, h: 6, minW: 3, minH: 3 },
    { i: 'widget-recent-results', x: 5, y: 15, w: 5, h: 6, minW: 3, minH: 3 },
    { i: 'widget-election-leaderboard', x: 0, y: 21, w: 10, h: 7, minW: 3, minH: 3 },
  ];

  const sm: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-live-decisions', x: 0, y: 0, w: 3, h: 8, minW: 2, minH: 4 },
    { i: 'widget-my-vote-queue', x: 3, y: 0, w: 3, h: 8, minW: 2, minH: 4 },
    { i: 'widget-closing-soon', x: 0, y: 8, w: 3, h: 6, minW: 2, minH: 3 },
    { i: 'widget-indicative-pulse', x: 3, y: 8, w: 3, h: 6, minW: 2, minH: 3 },
    { i: 'widget-turnout-monitor', x: 0, y: 14, w: 3, h: 6, minW: 2, minH: 3 },
    { i: 'widget-recent-results', x: 3, y: 14, w: 3, h: 6, minW: 2, minH: 3 },
    { i: 'widget-election-leaderboard', x: 0, y: 20, w: 6, h: 7, minW: 2, minH: 3 },
  ];

  const xs: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-live-decisions', x: 0, y: 0, w: 4, h: 8, minW: 1, minH: 4 },
    { i: 'widget-my-vote-queue', x: 0, y: 8, w: 4, h: 6, minW: 1, minH: 3 },
    { i: 'widget-closing-soon', x: 0, y: 14, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-indicative-pulse', x: 2, y: 14, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-turnout-monitor', x: 0, y: 19, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-recent-results', x: 2, y: 19, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-election-leaderboard', x: 0, y: 24, w: 4, h: 6, minW: 1, minH: 3 },
  ];

  const xxs: DecisionTerminalGridLayoutItem[] = [
    { i: 'widget-live-decisions', x: 0, y: 0, w: 2, h: 8, minW: 1, minH: 4 },
    { i: 'widget-my-vote-queue', x: 0, y: 8, w: 2, h: 6, minW: 1, minH: 3 },
    { i: 'widget-closing-soon', x: 0, y: 14, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-indicative-pulse', x: 0, y: 19, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-turnout-monitor', x: 0, y: 24, w: 2, h: 5, minW: 1, minH: 3 },
    { i: 'widget-recent-results', x: 0, y: 29, w: 2, h: 6, minW: 1, minH: 3 },
    { i: 'widget-election-leaderboard', x: 0, y: 35, w: 2, h: 6, minW: 1, minH: 3 },
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

function getDecisionTimestamp(decision: DecisionItem) {
  const timestamp =
    decision.endsAt instanceof Date
      ? decision.endsAt.getTime()
      : new Date(decision.endsAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareDecisions(
  left: DecisionItem,
  right: DecisionItem,
  sort: DecisionTerminalWidgetConfig['sort']
) {
  switch (sort) {
    case 'recent':
      return getDecisionTimestamp(right) - getDecisionTimestamp(left);
    case 'turnout':
      return (right.turnout ?? 0) - (left.turnout ?? 0);
    case 'trend':
      return Math.abs(right.trend?.percentage ?? 0) - Math.abs(left.trend?.percentage ?? 0);
    case 'urgency':
      return (
        Number(right.isUrgent) - Number(left.isUrgent) ||
        getDecisionTimestamp(left) - getDecisionTimestamp(right)
      );
    case 'closing_soon':
    default:
      return getDecisionTimestamp(left) - getDecisionTimestamp(right);
  }
}

export function selectWidgetDecisions(
  decisions: DecisionItem[],
  widget: DecisionTerminalWidgetConfig,
  searchQuery = ''
) {
  const query = searchQuery.trim().toLowerCase();

  return decisions
    .filter(decision => {
      const filters = widget.filters;
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
    .sort((left, right) => compareDecisions(left, right, widget.sort))
    .slice(0, widget.limit ?? 10);
}
