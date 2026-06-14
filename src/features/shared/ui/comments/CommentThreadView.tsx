'use client';

import type { ReactNode } from 'react';

import { MessageSquare } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

import { CommentInput } from './CommentInput';
import { CommentItem, type CommentData } from './CommentItem';
import { CommentSortSelect, type CommentSortBy } from './CommentSortSelect';

interface CommentThreadViewProps {
  comments: CommentData[];
  threadedComments: CommentData[];
  currentUserId?: string;
  onAddComment: (text: string, parentId?: string) => Promise<void>;
  onVote: (
    commentId: string,
    voteValue: number,
    existingVote?: { id: string; vote: number }
  ) => Promise<void>;
  onReply: (parentId: string, text: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  hideHeader?: boolean;
  sortBy: CommentSortBy;
  onSortChange: (sortBy: CommentSortBy) => void;
  emptyState?: ReactNode;
  isSubmitting?: boolean;
  className?: string;
}

export function CommentThreadView({
  comments,
  threadedComments,
  currentUserId,
  onAddComment,
  onVote,
  onReply,
  onDelete,
  hideHeader,
  sortBy,
  onSortChange,
  emptyState,
  isSubmitting,
  className,
}: CommentThreadViewProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        {!hideHeader && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" />
            <span>
              {comments.length}
              {translateText('generated.inline.0909_comments_fce06e20')}
            </span>
          </div>
        )}
        <CommentSortSelect sortBy={sortBy} onSortChange={onSortChange} className="w-40" />
      </div>

      {currentUserId && (
        <CommentInput
          onSubmit={text => onAddComment(text)}
          placeholder={translateText('generated.inline.1115_add_a_comment_2339bc47')}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="space-y-4">
        {threadedComments.length === 0
          ? (emptyState ?? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {translateText(
                  'generated.inline.0395_no_comments_yet_be_the_first_to_comment_ba5c0dff'
                )}
              </p>
            ))
          : threadedComments.map((comment: any) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onVote={onVote}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
      </div>
    </div>
  );
}
