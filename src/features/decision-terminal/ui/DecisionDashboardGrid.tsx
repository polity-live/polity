'use client';

import type { DecisionTerminalDashboardConfig } from '@/zero/preferences';
import { useDecisionDashboardGridController } from '../hooks/useDecisionDashboardGridController';
import { DecisionDashboardGridView } from './DecisionDashboardGridView';
import type { DecisionItem } from './types';

interface DecisionDashboardGridProps {
  config: DecisionTerminalDashboardConfig;
  decisions: DecisionItem[];
  isLoading?: boolean;
  searchQuery?: string;
  onConfigChange: (config: DecisionTerminalDashboardConfig) => void;
  onVoteDecision: (decision: DecisionItem) => void;
}

export function DecisionDashboardGrid({
  config,
  decisions,
  isLoading = false,
  searchQuery = '',
  onConfigChange,
  onVoteDecision,
}: DecisionDashboardGridProps) {
  const { layouts, handleBreakpointChange, persistActiveLayout } =
    useDecisionDashboardGridController({
      config,
      onConfigChange,
    });

  return (
    <DecisionDashboardGridView
      config={config}
      decisions={decisions}
      layouts={layouts}
      isLoading={isLoading}
      searchQuery={searchQuery}
      onBreakpointChange={handleBreakpointChange}
      onLayoutPersist={persistActiveLayout}
      onVoteDecision={onVoteDecision}
    />
  );
}
