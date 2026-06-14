import { table, string, number, json } from '@rocicorp/zero';
import type { DecisionTerminalDashboardConfig, GroupNetworkLayouts } from './schema';

export const userPreference = table('user_preference')
  .columns({
    id: string(),
    user_id: string(),
    create_form_style: string(),
    theme: string(),
    language: string(),
    navigation_view: string(),
    group_network_layouts: json<GroupNetworkLayouts>(),
    decision_terminal_dashboard: json<DecisionTerminalDashboardConfig>().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
