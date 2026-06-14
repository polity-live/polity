import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useInfiniteScroll } from '@/features/shared/hooks/useInfiniteScroll';
import { useVotingMutations } from '@/features/votes/hooks/useVotingMutations';
import { useDiscussionMutations } from '../hooks/useDiscussionMutations';
import { useDiscussions } from '../hooks/useDiscussions';
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

  const { amendment, threads, isLoading, hasMore, loadMore } = useDiscussions(amendmentId, sortBy);
  const { createThread, createComment } = useDiscussionMutations();
  const { voteOnThread, voteOnComment } = useVotingMutations();

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });
  return {
    amendmentId,
    userId,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    sortBy,
    setSortBy,
    authUser,
    amendment,
    threads,
    isLoading,
    hasMore,
    loadMore,
    createThread,
    createComment,
    voteOnThread,
    voteOnComment,
    loadMoreRef,
  };
}
