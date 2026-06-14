'use client';

import { usePermissions } from '@/zero/rbac';
import type { DecisionItem } from './types';

interface DecisionVoteButtonProps {
  decision: DecisionItem;
  compact?: boolean;
  onVote: (decision: DecisionItem) => void;
}
export function useDecisionVoteButtonController({
  decision,
  compact = false,
  onVote,
}: DecisionVoteButtonProps) {
  const { canVote, isLoading } = usePermissions({ eventId: decision.eventId });

  return {
    decision,
    compact,
    onVote,
    canVote,
    isLoading,
  };
}
