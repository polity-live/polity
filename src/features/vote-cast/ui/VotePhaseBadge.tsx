'use client';

import { VotingPhaseBadge, type VotingPhaseBadgeProps } from '@/features/shared/ui/voting';
import type { VotingPhase } from '../logic/votePhaseHelpers';

interface VotePhaseBadgeProps extends Omit<VotingPhaseBadgeProps, 'phase'> {
  phase: VotingPhase;
}

export function VotePhaseBadge(props: VotePhaseBadgeProps) {
  return <VotingPhaseBadge {...props} />;
}
