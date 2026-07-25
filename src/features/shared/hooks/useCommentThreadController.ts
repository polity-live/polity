import { useMemo, useState } from 'react';

import type { CommentData } from '@/features/shared/ui/comments/CommentItem';
import type { CommentSortBy } from '@/features/shared/ui/comments/CommentSortSelect';

function commentScore(comment: CommentData) {
  const upvotes = comment.upvotes ?? comment.votes?.filter(vote => vote.vote === 1).length ?? 0;
  const downvotes =
    comment.downvotes ?? comment.votes?.filter(vote => vote.vote === -1).length ?? 0;
  return upvotes - downvotes;
}

interface UseCommentThreadControllerProps {
  comments: CommentData[];
  onAddComment: (text: string, parentId?: string) => Promise<void>;
  sortBy?: CommentSortBy;
  onSortChange?: (sortBy: CommentSortBy) => void;
}

export function useCommentThreadController({
  comments,
  onAddComment,
  sortBy: controlledSortBy,
  onSortChange,
}: UseCommentThreadControllerProps) {
  const [internalSortBy, setInternalSortBy] = useState<CommentSortBy>('votes');
  const [isCommenting, setIsCommenting] = useState(false);
  const sortBy = controlledSortBy ?? internalSortBy;

  const threadedComments = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_id);

    if (sortBy === 'time') {
      return [...topLevel].sort((a, b) => b.createdAt - a.createdAt);
    }

    return [...topLevel].sort((a, b) => commentScore(b) - commentScore(a));
  }, [comments, sortBy]);

  const handleSortChange = (nextSortBy: CommentSortBy) => {
    setInternalSortBy(nextSortBy);
    onSortChange?.(nextSortBy);
  };

  const handleReply = async (parentId: string, text: string) => {
    await onAddComment(text, parentId);
  };

  const handleAddRootComment = async (text: string) => {
    await onAddComment(text);
    setIsCommenting(false);
  };

  return {
    sortBy,
    threadedComments,
    onSortChange: handleSortChange,
    onReply: handleReply,
    isCommenting,
    setIsCommenting,
    onAddRootComment: handleAddRootComment,
  };
}
