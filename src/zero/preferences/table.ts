import { table, string, number, json } from '@rocicorp/zero';
import type { DecisionTerminalDashboardConfig, GroupNetworkLayouts } from './schema';

export const userPreference = table('user_preference')
  .columns({
    id: string(),
    user_id: string(),
    create_form_style: string(),
    theme: string(),
    appearance_theme_id: string().optional(),
    language: string(),
    display_currency: string(),
    navigation_view: string(),
    group_network_layouts: json<GroupNetworkLayouts>(),
    decision_terminal_dashboard: json<DecisionTerminalDashboardConfig>().optional(),
    app_tutorial_completed_at: number().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
