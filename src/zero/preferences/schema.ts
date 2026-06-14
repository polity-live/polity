import { z } from 'zod';
import { timestampSchema } from '../shared/helpers';

// ============================================
// User Preference
// ============================================
export const createFormStyleEnum = z.enum(['one_page', 'carousel', 'auto']);
export const themeEnum = z.enum(['dark', 'light', 'system']);
export const languageEnum = z.enum(['en', 'de']);
export const navigationViewEnum = z.enum(['asButton', 'asButtonList', 'asLabeledButtonList']);

export const decisionTerminalWidgetTypeEnum = z.enum([
  'live_decisions',
  'my_vote_queue',
  'closing_soon',
  'indicative_pulse',
  'turnout_monitor',
  'recent_results',
  'election_leaderboard',
]);

export const decisionTerminalWidgetDisplayModeEnum = z.enum([
  'table',
  'tape',
  'list',
  'metric',
  'leaderboard',
]);

export const decisionTerminalWidgetSortEnum = z.enum([
  'closing_soon',
  'recent',
  'turnout',
  'urgency',
  'trend',
]);

export const decisionTerminalWidgetVisibilityEnum = z.enum([
  'all',
  'public',
  'authenticated',
  'private',
]);

export const decisionTerminalWidgetFiltersSchema = z.object({
  status: z.array(z.enum(['live', 'opening_soon', 'recently_closed', 'closed', 'all'])).optional(),
  types: z.array(z.enum(['vote', 'election'])).optional(),
  onlyVotable: z.boolean().optional(),
  onlyUrgent: z.boolean().optional(),
  onlyIndicative: z.boolean().optional(),
  minTurnout: z.number().optional(),
});

export const decisionTerminalWidgetSchema = z.object({
  id: z.string(),
  type: decisionTerminalWidgetTypeEnum,
  title: z.string(),
  filters: decisionTerminalWidgetFiltersSchema.optional(),
  displayMode: decisionTerminalWidgetDisplayModeEnum,
  sort: decisionTerminalWidgetSortEnum.optional(),
  limit: z.number().optional(),
  visibility: decisionTerminalWidgetVisibilityEnum.optional(),
});

export const decisionTerminalGridLayoutItemSchema = z.object({
  i: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
  static: z.boolean().optional(),
});

export const decisionTerminalDashboardConfigSchema = z.object({
  version: z.number(),
  widgets: z.array(decisionTerminalWidgetSchema),
  layouts: z.record(z.array(decisionTerminalGridLayoutItemSchema)),
});

export const networkLayoutPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const groupNetworkLayoutSchema = z.object({
  node_positions: z.record(networkLayoutPositionSchema),
  edge_bend_points: z.record(z.array(networkLayoutPositionSchema)),
});

export const groupNetworkLayoutsSchema = z.record(groupNetworkLayoutSchema);

const baseUserPreferenceSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  create_form_style: createFormStyleEnum,
  theme: themeEnum,
  language: languageEnum,
  navigation_view: navigationViewEnum,
  group_network_layouts: groupNetworkLayoutsSchema,
  decision_terminal_dashboard: decisionTerminalDashboardConfigSchema.optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectUserPreferenceSchema = baseUserPreferenceSchema;

export const createUserPreferenceSchema = baseUserPreferenceSchema
  .omit({ id: true, created_at: true, updated_at: true, user_id: true })
  .extend({ id: z.string() });

export const updateUserPreferenceSchema = z.object({
  id: z.string(),
  create_form_style: createFormStyleEnum.optional(),
  theme: themeEnum.optional(),
  language: languageEnum.optional(),
  navigation_view: navigationViewEnum.optional(),
  group_network_layouts: groupNetworkLayoutsSchema.optional(),
  decision_terminal_dashboard: decisionTerminalDashboardConfigSchema.optional(),
});

// ============================================
// Inferred Types
// ============================================
export type UserPreference = z.infer<typeof selectUserPreferenceSchema>;
export type CreateFormStyle = z.infer<typeof createFormStyleEnum>;
export type Theme = z.infer<typeof themeEnum>;
export type PreferenceLanguage = z.infer<typeof languageEnum>;
export type PreferenceNavigationView = z.infer<typeof navigationViewEnum>;
export type NetworkLayoutPosition = z.infer<typeof networkLayoutPositionSchema>;
export type GroupNetworkLayout = z.infer<typeof groupNetworkLayoutSchema>;
export type GroupNetworkLayouts = z.infer<typeof groupNetworkLayoutsSchema>;
export type DecisionTerminalWidgetType = z.infer<typeof decisionTerminalWidgetTypeEnum>;
export type DecisionTerminalWidgetDisplayMode = z.infer<
  typeof decisionTerminalWidgetDisplayModeEnum
>;
export type DecisionTerminalWidgetSort = z.infer<typeof decisionTerminalWidgetSortEnum>;
export type DecisionTerminalWidgetVisibility = z.infer<typeof decisionTerminalWidgetVisibilityEnum>;
export type DecisionTerminalWidgetFilters = z.infer<typeof decisionTerminalWidgetFiltersSchema>;
export type DecisionTerminalWidgetConfig = z.infer<typeof decisionTerminalWidgetSchema>;
export type DecisionTerminalGridLayoutItem = z.infer<typeof decisionTerminalGridLayoutItemSchema>;
export type DecisionTerminalDashboardConfig = z.infer<typeof decisionTerminalDashboardConfigSchema>;
