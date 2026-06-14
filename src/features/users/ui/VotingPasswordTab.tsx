'use client';

import { useVotingPasswordTabController } from '../hooks/useVotingPasswordTabController';
import { VotingPasswordTabShellView } from './VotingPasswordTabShellView';

interface VotingPasswordTabProps {
  userId: string;
}

export function VotingPasswordTab({ userId }: VotingPasswordTabProps) {
  return <VotingPasswordTabShellView {...useVotingPasswordTabController({ userId })} />;
}
