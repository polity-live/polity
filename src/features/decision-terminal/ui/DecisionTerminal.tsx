'use client';

import { useDecisionTerminalDashboardController } from '../hooks/useDecisionTerminalDashboardController';
import { DecisionTerminalView } from './DecisionTerminalView';
import { DecisionVoteDialogController } from './DecisionVoteDialog';
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
  const controller = useDecisionTerminalDashboardController({ decisions });

  return (
    <div data-tutorial-anchor="tutorial-decision-terminal-item">
      <DecisionTerminalView
        decisions={decisions}
        dashboardConfig={controller.dashboardConfig}
        searchQuery={controller.searchQuery}
        urgentCount={controller.urgentCount}
        activeCount={controller.activeCount}
        isLoading={isLoading || controller.preferencesLoading}
        className={className}
        onSearchChange={controller.setSearchQuery}
        onResetLayout={controller.handleResetLayout}
        onConfigChange={controller.persistConfig}
        onVoteDecision={controller.handleVoteDecision}
        voteDialog={
          <DecisionVoteDialogController
            decision={controller.voteTarget}
            open={controller.voteDialogOpen}
            onOpenChange={controller.handleVoteDialogOpenChange}
          />
        }
      />
    </div>
  );
}
