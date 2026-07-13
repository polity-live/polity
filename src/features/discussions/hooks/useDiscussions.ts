import { useMemo, useState } from 'react';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import {
  buildCommentTree,
  sortComments,
  sortCommentTree,
  type CommentWithReplies,
} from '../utils/comment-tree';
import type { AmendmentThreadRow } from '@/zero/amendments/queries';

export type Thread = Omit<AmendmentThreadRow, 'comments'> & { comments: CommentWithReplies[] };

export function normalizeDiscussionThread(
  thread: AmendmentThreadRow,
  sortBy: 'votes' | 'time'
): Thread {
  const rootComments = buildCommentTree([...(thread.comments || [])]);
  return {
    ...thread,
    comments: sortComments(rootComments, sortBy).map(comment => sortCommentTree(comment, sortBy)),
  };
}

export function useDiscussions(amendmentId: string, sortBy: 'votes' | 'time' = 'votes') {
  // Zero uses limit-based pagination. Increase limit to load more results.
  const [limit, setLimit] = useState(10);

  // Fetch amendment data
  const { amendment, isLoading: amendmentLoading } = useAmendmentState({ amendmentId });

  // Fetch threads with detailed nested data via facade
  const { threads: threadsResults, isLoading: threadsLoading } = useAmendmentState({
    amendmentId,
    includeThreads: true,
  });

  const rawThreads = threadsResults || [];

  // Process threads with comment trees
  const threads = useMemo(() => {
    return rawThreads.map(thread => normalizeDiscussionThread(thread, sortBy));
  }, [rawThreads, sortBy]);

  const isLoading = amendmentLoading || threadsLoading;

  const loadMore = () => {
    setLimit(prev => prev + 10);
  };

  return {
    amendment,
    threads,
    isLoading,
    hasMore: rawThreads.length >= limit,
    loadMore,
  };
}
