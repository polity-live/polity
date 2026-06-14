'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePreferenceActions, usePreferenceState } from '@/zero/preferences';
import type { DecisionTerminalDashboardConfig } from '@/zero/preferences';

import {
  createDefaultDecisionTerminalDashboardConfig,
  normalizeDecisionTerminalDashboardConfig,
} from '../logic/dashboard-config';
import type { DecisionItem } from '../ui/types';

interface UseDecisionTerminalDashboardControllerOptions {
  decisions: DecisionItem[];
}

export function useDecisionTerminalDashboardController({
  decisions,
}: UseDecisionTerminalDashboardControllerOptions) {
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

  const urgentCount = useMemo(
    () =>
      decisions.filter(
        decision => !decision.isClosed && (decision.isUrgent || decision.status === 'final_minutes')
      ).length,
    [decisions]
  );

  const activeCount = useMemo(
    () => decisions.filter(decision => !decision.isClosed && !decision.isOpeningSoon).length,
    [decisions]
  );

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

  const handleVoteDialogOpenChange = useCallback((open: boolean) => {
    setVoteDialogOpen(open);
    if (!open) {
      setVoteTarget(null);
    }
  }, []);

  const handleResetLayout = useCallback(() => {
    persistConfig(createDefaultDecisionTerminalDashboardConfig());
  }, [persistConfig]);

  return {
    dashboardConfig,
    preferencesLoading,
    searchQuery,
    setSearchQuery,
    voteTarget,
    voteDialogOpen,
    handleVoteDialogOpenChange,
    persistConfig,
    handleVoteDecision,
    handleResetLayout,
    urgentCount,
    activeCount,
  };
}
