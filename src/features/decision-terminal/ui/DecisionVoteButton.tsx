'use client';

import type { DecisionItem } from './types';

interface DecisionVoteButtonProps {
  decision: DecisionItem;
  compact?: boolean;
  onVote: (decision: DecisionItem) => void;
}
import { useDecisionVoteButtonController } from './useDecisionVoteButtonController';
import { DecisionVoteButtonView } from './DecisionVoteButtonView';
export function DecisionVoteButton({ decision, compact = false, onVote }: DecisionVoteButtonProps) {
  const viewProps = useDecisionVoteButtonController({ decision, compact, onVote });

  return <DecisionVoteButtonView {...viewProps} />;
}
