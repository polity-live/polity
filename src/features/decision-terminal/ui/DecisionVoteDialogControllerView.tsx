'use client';

import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
export interface DecisionVoteDialogControllerViewProps {
  decision: any;
  open: any;
  onOpenChange: any;
  dialogProps: any;
}

export function DecisionVoteDialogControllerView({
  dialogProps,
}: DecisionVoteDialogControllerViewProps) {
  if (!dialogProps) return null;

  return <VoteCastDialog {...dialogProps} />;
}
