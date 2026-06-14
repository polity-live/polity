'use client';

import type { ReactNode } from 'react';

import type { DecisionTerminalDashboardConfig } from '@/zero/preferences';
import { cn } from '@/features/shared/utils/utils';

import { DecisionDashboardGrid } from './DecisionDashboardGrid';
import { DecisionDashboardHeader } from './DecisionDashboardHeader';
import type { DecisionItem } from './types';

export interface DecisionTerminalViewProps {
  decisions: DecisionItem[];
  dashboardConfig: DecisionTerminalDashboardConfig;
  searchQuery: string;
  urgentCount: number;
  activeCount: number;
  isLoading?: boolean;
  className?: string;
  voteDialog?: ReactNode;
  onSearchChange: (query: string) => void;
  onResetLayout: () => void;
  onConfigChange: (config: DecisionTerminalDashboardConfig) => void;
  onVoteDecision: (decision: DecisionItem) => void;
}

export function DecisionTerminalView({
  decisions,
  dashboardConfig,
  searchQuery,
  urgentCount,
  activeCount,
  isLoading = false,
  className,
  voteDialog,
  onSearchChange,
  onResetLayout,
  onConfigChange,
  onVoteDecision,
}: DecisionTerminalViewProps) {
  return (
    <div
      className={cn(
        'bg-card flex h-full min-h-[640px] flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700',
        className
      )}
      data-testid="decision-terminal"
    >
      <DecisionDashboardHeader
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onResetLayout={onResetLayout}
        urgentCount={urgentCount}
        activeCount={activeCount}
      />

      <div className="bg-muted/20 flex-1 overflow-auto">
        <DecisionDashboardGrid
          config={dashboardConfig}
          decisions={decisions}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onConfigChange={onConfigChange}
          onVoteDecision={onVoteDecision}
        />
      </div>

      {voteDialog}
    </div>
  );
}
