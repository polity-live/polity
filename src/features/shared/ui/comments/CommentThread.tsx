'use client';

import type { ReactNode } from 'react';

import { useCommentThreadController } from '@/features/shared/hooks/useCommentThreadController';
import type { CommentData } from './CommentItem';
import type { CommentSortBy } from './CommentSortSelect';
import { CommentThreadView } from './CommentThreadView';

interface CommentThreadProps {
  comments: CommentData[];
  currentUserId?: string;
  onAddComment: (text: string, parentId?: string) => Promise<void>;
  onVote: (
    commentId: string,
    voteValue: number,
    existingVote?: { id: string; vote: number }
  ) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  hideHeader?: boolean;
  sortBy?: CommentSortBy;
  onSortChange?: (sortBy: CommentSortBy) => void;
  emptyState?: ReactNode;
  isSubmitting?: boolean;
  className?: string;
}

export function CommentThread({
  comments,
  currentUserId,
  onAddComment,
  onVote,
  onDelete,
  hideHeader,
  sortBy: controlledSortBy,
  onSortChange,
  emptyState,
  isSubmitting,
  className,
}: CommentThreadProps) {
  return (
    <CommentThreadView
      comments={comments}
      currentUserId={currentUserId}
      onAddComment={onAddComment}
      onVote={onVote}
      onDelete={onDelete}
      hideHeader={hideHeader}
      emptyState={emptyState}
      isSubmitting={isSubmitting}
      className={className}
      {...useCommentThreadController({
        comments,
        onAddComment,
        sortBy: controlledSortBy,
        onSortChange,
      })}
    />
  );
}
