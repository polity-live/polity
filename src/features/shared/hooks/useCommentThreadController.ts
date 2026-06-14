import { useMemo, useState } from 'react';

import type { CommentData } from '@/features/shared/ui/comments/CommentItem';
import type { CommentSortBy } from '@/features/shared/ui/comments/CommentSortSelect';

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
  const sortBy = controlledSortBy ?? internalSortBy;

  const threadedComments = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_id);

    if (sortBy === 'time') {
      return [...topLevel].sort((a, b) => b.createdAt - a.createdAt);
    }

    return [...topLevel].sort((a, b) => {
      const aScore =
        (a.votes?.filter(v => v.vote === 1).length || 0) -
        (a.votes?.filter(v => v.vote === -1).length || 0);
      const bScore =
        (b.votes?.filter(v => v.vote === 1).length || 0) -
        (b.votes?.filter(v => v.vote === -1).length || 0);
      return bScore - aScore;
    });
  }, [comments, sortBy]);

  const handleSortChange = (nextSortBy: CommentSortBy) => {
    setInternalSortBy(nextSortBy);
    onSortChange?.(nextSortBy);
  };

  const handleReply = async (parentId: string, text: string) => {
    await onAddComment(text, parentId);
  };

  return {
    sortBy,
    threadedComments,
    onSortChange: handleSortChange,
    onReply: handleReply,
  };
}
