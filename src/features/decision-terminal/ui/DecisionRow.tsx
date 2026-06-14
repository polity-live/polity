'use client';
import type { DecisionItem } from './types';
export interface DecisionRowProps {
  decision: DecisionItem;
}

import { useDecisionRowController } from './useDecisionRowController';
import { DecisionRowView } from './DecisionRowView';

export function DecisionRow({ decision }: DecisionRowProps) {
  const viewProps = useDecisionRowController({ decision });

  return <DecisionRowView {...viewProps} />;
}
