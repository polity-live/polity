'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/features/shared/utils/utils';
import { usePreferenceActions, usePreferenceState } from '@/zero/preferences';
import type { DecisionTerminalDashboardConfig } from '@/zero/preferences';
import {
  createDefaultDecisionTerminalDashboardConfig,
  normalizeDecisionTerminalDashboardConfig,
} from '../logic/dashboard-config';
import { DecisionDashboardGrid } from './DecisionDashboardGrid';
import { DecisionDashboardHeader } from './DecisionDashboardHeader';
import { DecisionVoteDialogController } from './DecisionVoteDialogController';
import type { DecisionItem } from './types';

export interface DecisionTerminalProps {
  decisions: DecisionItem[];
  isLoading?: boolean;
  className?: string;
}

/**
 * Decision Terminal - always-on draggable and resizable grid for active decisions.
 */
export function DecisionTerminal({
  decisions,
  isLoading = false,
  className,
}: DecisionTerminalProps) {
  const { decisionTerminalDashboard, isLoading: preferencesLoading } = usePreferenceState();
  const { saveDecisionTerminalDashboard } = usePreferenceActions();
  const [dashboardConfig, setDashboardConfig] = useState<DecisionTerminalDashboardConfig>(() =>
    createDefaultDecisionTerminalDashboardConfig()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [voteTarget, setVoteTarget] = useState<DecisionItem | null>(null);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);

  useEffect(() => {
    setDashboardConfig(normalizeDecisionTerminalDashboardConfig(decisionTerminalDashboard));
  }, [decisionTerminalDashboard]);

  const urgentCount = decisions.filter(
    d => !d.isClosed && (d.isUrgent || d.status === 'final_minutes')
  ).length;
  const activeCount = decisions.filter(d => !d.isClosed && !d.isOpeningSoon).length;

  const persistConfig = useCallback(
    (nextConfig: DecisionTerminalDashboardConfig) => {
      setDashboardConfig(nextConfig);
      saveDecisionTerminalDashboard(nextConfig);
    },
    [saveDecisionTerminalDashboard]
  );

  const handleVoteDecision = useCallback((decision: DecisionItem) => {
    setVoteTarget(decision);
    setVoteDialogOpen(true);
  }, []);

  const handleResetLayout = useCallback(() => {
    persistConfig(createDefaultDecisionTerminalDashboardConfig());
  }, [persistConfig]);

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
        onSearchChange={setSearchQuery}
        onResetLayout={handleResetLayout}
        urgentCount={urgentCount}
        activeCount={activeCount}
      />

      <div className="bg-muted/20 flex-1 overflow-auto">
        <DecisionDashboardGrid
          config={dashboardConfig}
          decisions={decisions}
          isLoading={isLoading || preferencesLoading}
          searchQuery={searchQuery}
          onConfigChange={persistConfig}
          onVoteDecision={handleVoteDecision}
        />
      </div>

      <DecisionVoteDialogController
        decision={voteTarget}
        open={voteDialogOpen}
        onOpenChange={open => {
          setVoteDialogOpen(open);
          if (!open) setVoteTarget(null);
        }}
      />
    </div>
  );
}
