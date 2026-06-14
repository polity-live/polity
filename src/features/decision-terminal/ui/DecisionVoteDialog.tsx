'use client';

import { useDecisionVoteDialogController } from '@/features/decision-terminal/hooks/useDecisionVoteDialogController';
import type { DecisionItem } from './types';

interface DecisionVoteDialogControllerProps {
  decision: DecisionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
import { DecisionVoteDialogControllerView } from './DecisionVoteDialogControllerView';
export function DecisionVoteDialogController({
  decision,
  open,
  onOpenChange,
}: DecisionVoteDialogControllerProps) {
  const { dialogProps } = useDecisionVoteDialogController({ decision, open, onOpenChange });
  return (
    <DecisionVoteDialogControllerView
      decision={decision}
      open={open}
      onOpenChange={onOpenChange}
      dialogProps={dialogProps}
    />
  );
}
