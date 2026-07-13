import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useVotingMutations } from '@/features/votes/hooks/useVotingMutations';
import { useDiscussionMutations } from '../hooks/useDiscussionMutations';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { type DiscussionSortMode } from './DiscussionsView';

interface DiscussionsPageContainerProps {
  amendmentId: string;
  userId?: string;
}
export function useDiscussionsPageContainerController({
  amendmentId,
  userId,
}: DiscussionsPageContainerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<DiscussionSortMode>('votes');
  const { user: authUser } = useAuth();

  const { amendment, isLoading } = useAmendmentState({ amendmentId });
  const { createThread, createComment } = useDiscussionMutations();
  const { voteOnThread, voteOnComment } = useVotingMutations();

  return {
    amendmentId,
    userId,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    sortBy,
    setSortBy,
    authUser,
    amendment,
    isLoading,
    createThread,
    createComment,
    voteOnThread,
    voteOnComment,
  };
}
