'use client';

import { useDecisionVoteDialogController } from '@/features/decision-terminal/hooks/useDecisionVoteDialogController';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import type { DecisionItem } from './types';

interface DecisionVoteDialogControllerProps {
  decision: DecisionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DecisionVoteDialogController({
  decision,
  open,
  onOpenChange,
}: DecisionVoteDialogControllerProps) {
  const { dialogProps } = useDecisionVoteDialogController({ decision, open, onOpenChange });

  if (!dialogProps) return null;

  return <VoteCastDialog {...dialogProps} />;
}
